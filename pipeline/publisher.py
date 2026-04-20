import os
import re
import unicodedata
from datetime import date, datetime, timezone

import requests
from loguru import logger

from pipeline.models import CurationOutput
from pipeline.storage import (
    count_articles_for_edition,
    create_edition,
    create_service_supabase,
    delete_edition_tree,
    get_edition_by_slug,
    get_next_edition_number,
    replace_articles_for_edition,
    update_edition,
)

MIN_READY_STORIES = 5
MAX_READY_STORIES = 8


def slugify(text: str, max_length: int = 80) -> str:
    """Gera um slug URL-safe a partir de texto."""
    text = unicodedata.normalize("NFD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    if len(text) > max_length:
        text = text[:max_length].rsplit("-", 1)[0]
    return text


def get_today_slug() -> str:
    return date.today().strftime("%Y-%m-%d")


def build_articles_payload(edition_id: str, curation: CurationOutput) -> list[dict]:
    used_slugs: set[str] = set()
    articles_payload = []

    for i, article in enumerate(curation.articles):
        base_slug = slugify(article.title_ptbr or article.canonical_topic or article.title)
        slug = base_slug
        counter = 2
        while slug in used_slugs:
            slug = f"{base_slug}-{counter}"
            counter += 1
        used_slugs.add(slug)

        articles_payload.append({
            "edition_id": edition_id,
            "title": article.title,
            "title_ptbr": article.title_ptbr,
            "url": article.url,
            "summary_ptbr": article.summary_ptbr,
            "content_ptbr": article.content_ptbr,
            "source": article.source,
            "category": article.category,
            "original_language": article.original_language,
            "reading_time_min": article.reading_time_min,
            "canonical_topic": article.canonical_topic,
            "primary_source_url": article.primary_source_url or article.url,
            "primary_source_label": article.primary_source_label or article.source,
            "source_count": article.source_count,
            "source_items": [source.model_dump() for source in article.source_items],
            "status": "active",
            "position": i + 1,
            "slug": slug,
        })

    return articles_payload


def ensure_draft_edition(supabase, slug: str) -> dict:
    existing = get_edition_by_slug(supabase, slug)
    if not existing:
        edition_number = get_next_edition_number(supabase)
        title = f"DevPulse #{edition_number}"
        logger.info(f"[Publisher] Criando rascunho: {title} ({slug})")
        return create_edition(
            supabase,
            slug=slug,
            edition_number=edition_number,
            title=title,
        )

    if existing.get("published_at"):
        raise RuntimeError(
            f"[Publisher] Ja existe uma edicao publicada para {slug} "
            f"(#{existing['edition_number']}, {existing['title']})."
        )

    logger.info(
        f"[Publisher] Reutilizando rascunho existente #{existing['edition_number']} ({slug})"
    )
    return existing


def trigger_newsletter_delivery(edition_id: str) -> dict:
    web_url = os.environ.get("SITE_URL", "http://localhost:4321")
    api_secret = os.environ["NEWSLETTER_API_SECRET"]

    try:
        response = requests.post(
            f"{web_url}/api/send-newsletter",
            json={"edition_id": edition_id},
            headers={"Authorization": f"Bearer {api_secret}"},
            timeout=30,
        )
    except requests.RequestException as exc:
        raise RuntimeError(f"Falha ao chamar API de envio: {exc}") from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {"raw": response.text}

    if response.status_code == 207:
        raise RuntimeError(f"Envio parcial da newsletter: {payload}")

    if not response.ok:
        raise RuntimeError(
            f"Falha no envio da newsletter: status={response.status_code}, payload={payload}"
        )

    return payload


def prepare_draft(curation: CurationOutput) -> str:
    """
    Prepara o rascunho da edicao do dia no Supabase, sem publicar no site nem enviar emails.
    """
    story_count = len(curation.articles)
    if story_count < MIN_READY_STORIES or story_count > MAX_READY_STORIES:
        raise ValueError(
            f"[Publisher] Curadoria retornou {story_count} matérias; "
            f"o intervalo esperado e de {MIN_READY_STORIES} a {MAX_READY_STORIES}."
        )
    if not curation.edition_summary.strip():
        raise ValueError("[Publisher] Curadoria retornou edition_summary vazio.")

    supabase = create_service_supabase()
    slug = get_today_slug()
    edition = ensure_draft_edition(supabase, slug)
    edition_id = edition["id"]
    previous_article_count = count_articles_for_edition(supabase, edition_id)

    articles_payload = build_articles_payload(edition_id, curation)

    update_edition(
        supabase,
        edition_id,
        summary=curation.edition_summary.strip(),
        prepared_at=None,
        published_at=None,
        sent_at=None,
    )

    try:
        replace_articles_for_edition(supabase, edition_id, articles_payload)
        update_edition(
            supabase,
            edition_id,
            summary=curation.edition_summary.strip(),
            prepared_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception:
        logger.exception("[Publisher] Falha ao salvar o rascunho preparado")
        if previous_article_count == 0:
            delete_edition_tree(supabase, edition_id)
        raise

    logger.info(f"[Publisher] Rascunho pronto com {len(articles_payload)} matérias")
    return edition_id


def assert_draft_ready(slug: str | None = None) -> dict:
    supabase = create_service_supabase()
    slug = slug or get_today_slug()
    edition = get_edition_by_slug(supabase, slug)

    if not edition:
        raise RuntimeError(f"[Publisher] Nenhum rascunho encontrado para {slug}.")

    article_count = count_articles_for_edition(supabase, edition["id"])

    if not edition.get("prepared_at"):
        raise RuntimeError(f"[Publisher] O rascunho {slug} ainda nao foi marcado como pronto.")

    if article_count < MIN_READY_STORIES or article_count > MAX_READY_STORIES:
        raise RuntimeError(
            f"[Publisher] O rascunho {slug} tem {article_count} matérias; "
            f"intervalo esperado: {MIN_READY_STORIES}-{MAX_READY_STORIES}."
        )
    if not edition.get("summary"):
        raise RuntimeError(f"[Publisher] O rascunho {slug} nao possui edition_summary.")

    logger.info(
        f"[Publisher] Rascunho validado: #{edition['edition_number']} ({slug}) com {article_count} matérias"
    )
    return edition


def publish_ready_draft(slug: str | None = None) -> str:
    """
    Publica no site e dispara o envio do email para o rascunho pronto do dia.
    """
    supabase = create_service_supabase()
    slug = slug or get_today_slug()
    edition = assert_draft_ready(slug)
    edition_id = edition["id"]

    if not edition.get("published_at"):
        update_edition(
            supabase,
            edition_id,
            published_at=datetime.now(timezone.utc).isoformat(),
        )
        logger.info(f"[Publisher] Edicao publicada no site: {slug}")
    else:
        logger.info(f"[Publisher] Edicao {slug} ja estava publicada; tentando concluir envio")

    if edition.get("sent_at"):
        logger.info("[Publisher] Newsletter ja enviada anteriormente; nada a fazer")
        return edition_id

    payload = trigger_newsletter_delivery(edition_id)
    logger.info(
        f"[Publisher] Envio concluido: total={payload.get('sent_total', payload.get('sent_now', 0))}, "
        f"novo={payload.get('sent_now', 0)}, ja-entregue={payload.get('already_sent', 0)}"
    )
    return edition_id


def publish(curation: CurationOutput) -> str:
    """
    Compatibilidade/uso local: prepara o rascunho e publica imediatamente.
    """
    edition_id = prepare_draft(curation)
    publish_ready_draft()
    return edition_id
