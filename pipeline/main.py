import argparse
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv
from loguru import logger

from pipeline.collectors import github_trending, reddit, rss
from pipeline.curator import curate, normalize_url
from pipeline.models import CurationOutput, RawArticle
from pipeline.notifications import build_failure_alert, send_discord_alert
from pipeline.publisher import assert_draft_ready, prepare_draft, publish, publish_ready_draft
from pipeline.storage import create_service_supabase, list_editorial_suppressions

# Carrega variáveis de ambiente do .env.local na raiz do projeto
load_dotenv(Path(__file__).parent.parent / ".env.local")

# ── Logging ───────────────────────────────────────────────────────────────────
logger.remove()
logger.add(sys.stderr, format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}")
logger.add("pipeline/logs/run_{time:YYYY-MM-DD}.log", rotation="1 week", retention="1 month")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Orquestrador do pipeline DevPulse")
    parser.add_argument(
        "mode",
        nargs="?",
        default="full",
        choices=["full", "prepare", "check-ready", "publish"],
        help="Modo de execucao do pipeline",
    )
    parser.add_argument(
        "--notify-on-failure",
        action="store_true",
        help="Envia alerta ao Discord se o modo falhar",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Executa validacoes e curadoria sem gravar rascunho, publicar ou enviar emails",
    )
    return parser.parse_args()


def load_sources() -> dict:
    sources_path = Path(__file__).parent / "sources.yaml"
    with open(sources_path, "r", encoding="utf-8") as file:
        return yaml.safe_load(file)


def apply_editorial_suppressions(raw_articles: list[RawArticle]) -> list[RawArticle]:
    try:
        supabase = create_service_supabase()
        suppressed_urls = {
            normalize_url(item["value"])
            for item in list_editorial_suppressions(supabase, scope="url")
        }
    except Exception as exc:
        logger.warning(f"[Pipeline] Falha ao carregar supressoes editoriais: {exc}")
        return raw_articles

    if not suppressed_urls:
        return raw_articles

    filtered = [
        article
        for article in raw_articles
        if normalize_url(article.url) not in suppressed_urls
    ]
    logger.info(
        f"[Pipeline] Supressoes por URL removeram {len(raw_articles) - len(filtered)} item(ns) da coleta"
    )
    return filtered


def apply_topic_suppressions(curation: CurationOutput) -> CurationOutput:
    try:
        supabase = create_service_supabase()
        suppressed_topics = {
            item["value"].strip().lower()
            for item in list_editorial_suppressions(supabase, scope="topic")
        }
        suppressed_urls = {
            normalize_url(item["value"])
            for item in list_editorial_suppressions(supabase, scope="url")
        }
    except Exception as exc:
        logger.warning(f"[Pipeline] Falha ao aplicar supressoes tematicas: {exc}")
        return curation

    if not suppressed_topics and not suppressed_urls:
        return curation

    filtered_articles = []
    for article in curation.articles:
        topic_key = (article.canonical_topic or article.title_ptbr or article.title).strip().lower()
        source_urls = {normalize_url(source.url) for source in article.source_items}

        if topic_key in suppressed_topics:
            logger.info(f"[Pipeline] Matéria suprimida por tópico: {topic_key}")
            continue
        if source_urls & suppressed_urls:
            logger.info(f"[Pipeline] Matéria suprimida por URL: {article.title_ptbr or article.title}")
            continue

        filtered_articles.append(article)

    if len(filtered_articles) == len(curation.articles):
        return curation

    logger.info(
        f"[Pipeline] Supressoes editoriais removeram {len(curation.articles) - len(filtered_articles)} matéria(s) após curadoria"
    )
    return CurationOutput(
        edition_summary=curation.edition_summary,
        articles=filtered_articles,
    )


def collect_and_curate():
    logger.info("=" * 50)
    logger.info("DevPulse pipeline iniciado")
    logger.info("=" * 50)

    sources = load_sources()

    # ── Fase 1: Coleta ────────────────────────────────────────────────────────
    logger.info("Iniciando coleta de artigos...")

    all_articles = []

    rss_articles = rss.collect(sources["rss"])
    all_articles.extend(rss_articles)

    github_articles = github_trending.collect(
        languages=sources["github_trending"]["languages"],
        since=sources["github_trending"]["since"],
    )
    all_articles.extend(github_articles)

    reddit_articles = reddit.collect(sources["reddit"])
    all_articles.extend(reddit_articles)

    all_articles = apply_editorial_suppressions(all_articles)
    logger.info(f"Total coletado: {len(all_articles)} itens candidatos")

    if not all_articles:
        raise RuntimeError("Nenhum artigo coletado. Abortando.")

    # ── Fase 2: Curadoria ─────────────────────────────────────────────────────
    logger.info("Iniciando curadoria multi-etapas (triagem -> leitura -> pauta -> redacao)...")

    curation = curate(all_articles)
    curation = apply_topic_suppressions(curation)

    logger.info(f"Curadoria concluída: {len(curation.articles)} matérias selecionadas")
    return curation


def _summarize_text(value: str, max_chars: int = 220) -> str:
    compact = " ".join((value or "").split())
    if len(compact) <= max_chars:
        return compact
    truncated = compact[:max_chars].rsplit(" ", 1)[0].strip()
    return f"{truncated or compact[:max_chars].strip()}..."


def _log_curation_preview(curation: CurationOutput) -> None:
    logger.info(f"[Dry-run] Resumo da edição: {_summarize_text(curation.edition_summary)}")
    for index, article in enumerate(curation.articles, start=1):
        title = article.title_ptbr or article.title
        logger.info(f"[Dry-run] {index}. [{article.category}] {title}")


def run(mode: str, *, dry_run: bool = False):
    if mode == "prepare":
        curation = collect_and_curate()
        if dry_run:
            logger.info("[Dry-run] Curadoria concluída; rascunho nao sera salvo no Supabase")
            _log_curation_preview(curation)
            edition_id = "dry-run"
        else:
            logger.info("Salvando rascunho preparado no Supabase...")
            edition_id = prepare_draft(curation)
    elif mode == "check-ready":
        logger.info("Verificando se o rascunho da semana esta pronto...")
        edition = assert_draft_ready()
        edition_id = edition["id"]
        if dry_run:
            logger.info(
                f"[Dry-run] Rascunho validado: slug={edition['slug']} "
                f"edition_number={edition['edition_number']}"
            )
    elif mode == "publish":
        if dry_run:
            logger.info("Validando publicacao sem alterar banco nem enviar emails...")
            edition = assert_draft_ready()
            logger.info(
                f"[Dry-run] Publicaria a edicao {edition['slug']} "
                f"(#{edition['edition_number']}) e chamaria /api/send-newsletter"
            )
            edition_id = edition["id"]
        else:
            logger.info("Publicando rascunho pronto e enviando emails...")
            edition_id = publish_ready_draft()
    else:
        curation = collect_and_curate()
        if dry_run:
            logger.info("[Dry-run] Curadoria concluída; nada sera salvo nem publicado")
            _log_curation_preview(curation)
            edition_id = "dry-run"
        else:
            logger.info("Preparando e publicando edicao imediatamente...")
            edition_id = publish(curation)

    logger.info("=" * 50)
    logger.info(f"Pipeline concluído com sucesso! edition_id={edition_id}")
    logger.info("=" * 50)


if __name__ == "__main__":
    args = parse_args()

    try:
        run(args.mode, dry_run=args.dry_run)
    except Exception as exc:
        logger.exception(f"Pipeline falhou no modo {args.mode}")
        if args.notify_on_failure:
            title, body = build_failure_alert(args.mode, str(exc))
            try:
                send_discord_alert(title, body)
            except Exception:
                logger.exception("Falha ao enviar alerta ao Discord")
        raise
