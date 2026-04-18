import os
import re
import unicodedata
import requests
from datetime import date
from loguru import logger
from supabase import create_client

from pipeline.models import CurationOutput


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


def publish(curation: CurationOutput) -> str:
    """
    Salva a edição e os artigos no Supabase e dispara o envio do e-mail.
    Retorna o edition_id gerado.
    """
    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    # ── 1. Gera slug e número da edição ──────────────────────────────────────
    today = date.today()
    slug = today.strftime("%Y-%m-%d")

    count_result = supabase.table("editions").select("id", count="exact").execute()
    edition_number = (count_result.count or 0) + 1
    title = f"DevPulse #{edition_number}"

    logger.info(f"[Publisher] Criando edição: {title} ({slug})")

    # ── 2. Insere a edição ────────────────────────────────────────────────────
    edition_result = (
        supabase.table("editions")
        .insert({"slug": slug, "edition_number": edition_number, "title": title})
        .execute()
    )

    edition_id = edition_result.data[0]["id"]
    logger.info(f"[Publisher] Edição criada com id={edition_id}")

    # ── 3. Insere os artigos ──────────────────────────────────────────────────
    used_slugs: set[str] = set()
    articles_payload = []
    for i, a in enumerate(curation.articles):
        base_slug = slugify(a.title)
        slug = base_slug
        counter = 2
        while slug in used_slugs:
            slug = f"{base_slug}-{counter}"
            counter += 1
        used_slugs.add(slug)
        articles_payload.append({
            "edition_id": edition_id,
            "title": a.title,
            "title_ptbr": a.title_ptbr,
            "url": a.url,
            "summary_ptbr": a.summary_ptbr,
            "content_ptbr": a.content_ptbr,
            "source": a.source,
            "category": a.category,
            "original_language": a.original_language,
            "reading_time_min": a.reading_time_min,
            "position": i + 1,
            "slug": slug,
        })

    supabase.table("articles").insert(articles_payload).execute()
    logger.info(f"[Publisher] {len(articles_payload)} artigos salvos")

    # ── 4. Dispara o envio do e-mail via API do Astro ────────────────────────
    web_url = os.environ.get("SITE_URL", "http://localhost:4321")
    api_secret = os.environ["NEWSLETTER_API_SECRET"]

    response = requests.post(
        f"{web_url}/api/send-newsletter",
        json={"edition_id": edition_id},
        headers={"Authorization": f"Bearer {api_secret}"},
        timeout=30,
    )

    if response.ok:
        data = response.json()
        logger.info(f"[Publisher] E-mail enviado para {data.get('sent_to', 0)} subscriber(s)")
    else:
        logger.error(f"[Publisher] Falha no envio do e-mail: {response.status_code} — {response.text}")

    return edition_id
