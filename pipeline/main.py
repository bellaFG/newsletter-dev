import sys
import yaml
from pathlib import Path
from dotenv import load_dotenv
from loguru import logger

from pipeline.collectors import rss, github_trending, reddit
from pipeline.curator import curate
from pipeline.publisher import publish

# Carrega variáveis de ambiente do .env.local na raiz do projeto
load_dotenv(Path(__file__).parent.parent / ".env.local")

# ── Logging ───────────────────────────────────────────────────────────────────
logger.remove()
logger.add(sys.stderr, format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}")
logger.add("pipeline/logs/run_{time:YYYY-MM-DD}.log", rotation="1 week", retention="1 month")


def load_sources() -> dict:
    sources_path = Path(__file__).parent / "sources.yaml"
    with open(sources_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def run():
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

    logger.info(f"Total coletado: {len(all_articles)} artigos")

    if not all_articles:
        logger.error("Nenhum artigo coletado. Abortando.")
        sys.exit(1)

    # ── Fase 2: Curadoria ─────────────────────────────────────────────────────
    logger.info("Iniciando curadoria com GPT-4o mini...")

    curation = curate(all_articles)

    logger.info(f"Curadoria concluída: {len(curation.articles)} artigos selecionados")

    # ── Fase 3: Publicação ────────────────────────────────────────────────────
    logger.info("Publicando edição no Supabase e enviando e-mails...")

    edition_id = publish(curation)

    logger.info("=" * 50)
    logger.info(f"Pipeline concluído com sucesso! edition_id={edition_id}")
    logger.info("=" * 50)


if __name__ == "__main__":
    run()
