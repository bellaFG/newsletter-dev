import json
import os
from collections import Counter
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from openai import OpenAI
from pydantic import ValidationError
from loguru import logger

from pipeline.models import AICurationOutput, ArticleSource, CuratedArticle, CurationOutput, RawArticle
from pipeline.prompts import CURATION_SYSTEM, build_curation_prompt

MODEL = "gpt-4o-mini"
MAX_RETRIES = 3
MIN_STORIES = 5
MAX_STORIES = 8
MAX_PER_CATEGORY = 2
TRACKING_QUERY_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "gclid",
    "fbclid",
    "mc_cid",
    "mc_eid",
    "ref",
    "ref_src",
}


def normalize_url(url: str) -> str:
    """Normaliza URLs para deduplicação e regras editoriais."""
    parts = urlsplit(url.strip())
    scheme = parts.scheme.lower() or "https"
    netloc = parts.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    path = parts.path.rstrip("/") or "/"
    query = urlencode([
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if key.lower() not in TRACKING_QUERY_PARAMS
    ])
    return urlunsplit((scheme, netloc, path, query, ""))


def _resolve_output(
    llm_output: AICurationOutput,
    indexed_articles: dict[int, RawArticle],
) -> CurationOutput:
    curated_articles: list[CuratedArticle] = []

    for story in llm_output.stories:
        source_ids = list(dict.fromkeys(story.source_ids))
        if story.primary_source_id not in source_ids:
            raise ValueError("primary_source_id precisa estar dentro de source_ids")

        resolved_sources: list[ArticleSource] = []
        for source_id in source_ids:
            raw = indexed_articles.get(source_id)
            if raw is None:
                raise ValueError(f"LLM retornou source_id inexistente: {source_id}")
            resolved_sources.append(
                ArticleSource(
                    label=raw.source,
                    url=raw.url,
                    title=raw.title,
                    snippet=raw.snippet,
                    is_primary=source_id == story.primary_source_id,
                )
            )

        if len(resolved_sources) < 2 or len(resolved_sources) > 5:
            raise ValueError("Cada matéria precisa consolidar entre 2 e 5 fontes")

        primary_source = indexed_articles[story.primary_source_id]
        curated_articles.append(
            CuratedArticle(
                title=primary_source.title,
                title_ptbr=story.title_ptbr.strip() if story.title_ptbr else None,
                url=primary_source.url,
                summary_ptbr=story.summary_ptbr.strip(),
                content_ptbr=story.content_ptbr.strip(),
                source=primary_source.source,
                category=story.category,
                original_language=story.original_language,
                reading_time_min=story.reading_time_min,
                canonical_topic=story.canonical_topic.strip(),
                source_count=len(resolved_sources),
                primary_source_url=primary_source.url,
                primary_source_label=primary_source.source,
                source_items=resolved_sources,
            )
        )

    return CurationOutput(
        edition_summary=llm_output.edition_summary.strip(),
        articles=curated_articles,
    )


def _validate_curation(result: CurationOutput) -> None:
    article_count = len(result.articles)
    if article_count < MIN_STORIES or article_count > MAX_STORIES:
        raise ValueError(
            f"Curadoria precisa retornar entre {MIN_STORIES} e {MAX_STORIES} matérias; recebeu {article_count}"
        )

    if not result.edition_summary.strip():
        raise ValueError("edition_summary vazio")

    category_counts = Counter(article.category for article in result.articles)
    category_overflow = [category for category, count in category_counts.items() if count > MAX_PER_CATEGORY]
    if category_overflow:
        raise ValueError(
            "Curadoria excedeu o limite por categoria: " + ", ".join(sorted(category_overflow))
        )

    topic_keys: set[str] = set()
    for article in result.articles:
        if not article.summary_ptbr.strip() or not (article.content_ptbr or "").strip():
            raise ValueError("Todas as matérias precisam ter resumo e conteúdo completo")
        if article.source_count < 2:
            raise ValueError("Todas as matérias precisam ter pelo menos 2 fontes")

        topic_key = (article.canonical_topic or article.title_ptbr or article.title).strip().lower()
        if topic_key in topic_keys:
            raise ValueError("Curadoria retornou temas duplicados")
        topic_keys.add(topic_key)


def curate(raw_articles: list[RawArticle]) -> CurationOutput:
    """
    Recebe a lista bruta de artigos coletados e retorna os melhores
    selecionados e resumidos pelo GPT-4o mini.
    """
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    # Deduplica por URL antes de enviar para a IA
    seen_urls: set[str] = set()
    unique_articles = []
    for a in raw_articles:
        normalized_url = normalize_url(a.url)
        if normalized_url not in seen_urls:
            seen_urls.add(normalized_url)
            unique_articles.append(a)

    logger.info(f"[Curator] {len(raw_articles)} artigos coletados → {len(unique_articles)} únicos após deduplicação")

    indexed_articles = {index: article for index, article in enumerate(unique_articles, start=1)}
    articles_payload = [
        {"id": index, "title": a.title, "url": a.url, "snippet": a.snippet, "source": a.source}
        for index, a in indexed_articles.items()
    ]

    prompt = build_curation_prompt(articles_payload)

    for attempt in range(1, MAX_RETRIES + 1):
        logger.info(f"[Curator] Tentativa {attempt}/{MAX_RETRIES}")

        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": CURATION_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
            )

            raw_json = response.choices[0].message.content
            data = json.loads(raw_json)
            llm_output = AICurationOutput.model_validate(data)
            result = _resolve_output(llm_output, indexed_articles)
            _validate_curation(result)

            logger.info(f"[Curator] {len(result.articles)} matérias editoriais selecionadas pela IA")
            return result

        except (ValidationError, ValueError) as e:
            logger.warning(f"[Curator] Output inválido na tentativa {attempt}: {e}")
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"IA retornou JSON inválido após {MAX_RETRIES} tentativas") from e

        except Exception as e:
            logger.error(f"[Curator] Erro na tentativa {attempt}: {e}")
            if attempt == MAX_RETRIES:
                raise
