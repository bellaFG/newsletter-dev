import re
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from loguru import logger

from pipeline.models import RawArticle

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 DevPulseBot/1.0"
    )
}
READ_TIMEOUT_SECONDS = 15
MAX_FETCH_BYTES = 1_500_000
CONTENT_SELECTORS = (
    "article",
    "main",
    "[role='main']",
    ".article-body",
    ".article-content",
    ".post-content",
    ".entry-content",
    ".markdown-body",
)
SKIP_HOSTS = {"reddit.com", "www.reddit.com"}


def enrich_articles(
    indexed_articles: dict[int, RawArticle],
    source_ids: set[int],
    *,
    max_chars: int,
) -> dict[int, RawArticle]:
    """Busca texto completo apenas das fontes aprovadas na triagem."""
    enriched = dict(indexed_articles)

    for source_id in sorted(source_ids):
        article = indexed_articles.get(source_id)
        if article is None:
            continue
        enriched[source_id] = enrich_article(article, max_chars=max_chars)

    return enriched


def enrich_article(article: RawArticle, *, max_chars: int) -> RawArticle:
    """Enriquece a matéria com texto completo ou sinaliza fallback para snippet."""
    metadata = dict(article.metadata)
    parsed = urlparse(article.url)
    host = parsed.netloc.lower()

    if article.collector == "github_trending" or host in SKIP_HOSTS:
        metadata["read_status"] = "snippet_only"
        return article.model_copy(update={"metadata": metadata})

    try:
        response = requests.get(
            article.url,
            headers=REQUEST_HEADERS,
            timeout=READ_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.warning(f"[Reader] Falha ao buscar {article.url}: {exc}")
        metadata["read_status"] = "fetch_error"
        return article.model_copy(update={"metadata": metadata})

    content_type = response.headers.get("content-type", "").lower()
    if "html" not in content_type:
        metadata["read_status"] = "non_html"
        return article.model_copy(update={"metadata": metadata})

    html = response.text[:MAX_FETCH_BYTES]
    extracted_text = _extract_text_from_html(html)
    if not extracted_text:
        metadata["read_status"] = "no_text"
        return article.model_copy(update={"metadata": metadata})

    excerpt = extracted_text[:max_chars].strip()
    if len(extracted_text) > max_chars:
        excerpt = excerpt.rsplit(" ", 1)[0].strip()

    metadata["read_status"] = "full_text"
    metadata["read_chars"] = len(excerpt)
    return article.model_copy(update={"full_text": excerpt, "metadata": metadata})


def _extract_text_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup([
        "script",
        "style",
        "noscript",
        "svg",
        "form",
        "header",
        "footer",
        "nav",
        "aside",
    ]):
        tag.decompose()

    candidates = []

    for selector in CONTENT_SELECTORS:
        for node in soup.select(selector):
            text = _collect_text_blocks(node)
            if len(text) >= 500:
                candidates.append(text)

    if not candidates:
        candidates.append(_collect_text_blocks(soup))

    best = max(candidates, key=len, default="")
    return best.strip()


def _collect_text_blocks(node) -> str:
    blocks: list[str] = []

    for element in node.find_all(["h1", "h2", "h3", "p", "li"], limit=250):
        text = _clean_text(element.get_text(" ", strip=True))
        if len(text) < 40:
            continue
        if blocks and blocks[-1] == text:
            continue
        blocks.append(text)

    if not blocks:
        return _clean_text(node.get_text(" ", strip=True))

    return "\n\n".join(blocks)


def _clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "")
    return text.strip()
