import feedparser
from datetime import datetime, timedelta, timezone
from loguru import logger
from pipeline.models import RawArticle


def collect(sources: list[dict]) -> list[RawArticle]:
    """Coleta artigos de todos os feeds RSS configurados em sources.yaml."""
    articles: list[RawArticle] = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    for source in sources:
        name = source["name"]
        url = source["url"]

        try:
            feed = feedparser.parse(url)

            if feed.bozo:
                logger.warning(f"[RSS] Feed com erro: {name} — {feed.bozo_exception}")

            count = 0
            for entry in feed.entries:
                published = _parse_date(entry)

                if published and published < cutoff:
                    continue

                title = entry.get("title", "").strip()
                link = entry.get("link", "").strip()
                snippet = _get_snippet(entry)

                if not title or not link:
                    continue

                articles.append(
                    RawArticle(
                        title=title,
                        url=link,
                        snippet=snippet,
                        source=name,
                        published_at=published,
                        collector="rss",
                        metadata={
                            "category_hint": source.get("category_hint"),
                            "feed_url": url,
                        },
                    )
                )
                count += 1

            logger.info(f"[RSS] {name}: {count} artigos coletados")

        except Exception as e:
            logger.error(f"[RSS] Falha ao coletar {name}: {e}")

    return articles


def _parse_date(entry) -> datetime | None:
    """Tenta extrair a data de publicação de uma entrada do feed."""
    for field in ("published_parsed", "updated_parsed"):
        value = entry.get(field)
        if value:
            try:
                return datetime(*value[:6], tzinfo=timezone.utc)
            except Exception:
                continue
    return None


def _get_snippet(entry) -> str:
    """Extrai o trecho de texto mais útil da entrada."""
    for field in ("summary", "description", "content"):
        value = entry.get(field)
        if isinstance(value, list) and value:
            value = value[0].get("value", "")
        if value and isinstance(value, str):
            # Remove tags HTML básicas
            import re
            clean = re.sub(r"<[^>]+>", " ", value)
            clean = " ".join(clean.split())
            return clean[:500]
    return ""
