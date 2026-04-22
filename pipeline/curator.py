import os
from collections import Counter
from time import monotonic
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from openai import OpenAI
from loguru import logger

from pipeline.article_reader import enrich_articles
from pipeline.models import (
    AICurationPlanOutput,
    AITriageOutput,
    AIWritingOutput,
    ArticleSource,
    CuratedArticle,
    CurationOutput,
    RawArticle,
)
from pipeline.prompts import (
    EDITORIAL_PLAN_SYSTEM,
    TRIAGE_SYSTEM,
    WRITER_SYSTEM,
    build_editorial_plan_prompt,
    build_triage_prompt,
    build_writing_prompt,
)

TRIAGE_MODEL = os.getenv("OPENAI_CURATION_TRIAGE_MODEL", "gpt-5.4-nano")
TRIAGE_REASONING = os.getenv("OPENAI_CURATION_TRIAGE_REASONING", "low")
EDITOR_MODEL = os.getenv("OPENAI_CURATION_EDITOR_MODEL", "gpt-5.4-mini")
EDITOR_REASONING = os.getenv("OPENAI_CURATION_EDITOR_REASONING", "medium")
WRITER_MODEL = os.getenv("OPENAI_CURATION_WRITER_MODEL", "gpt-5.4-mini")
WRITER_REASONING = os.getenv("OPENAI_CURATION_WRITER_REASONING", "low")
MAX_RETRIES = int(os.getenv("OPENAI_CURATION_MAX_RETRIES", "3"))
MAX_SOURCE_TEXT_CHARS = int(os.getenv("OPENAI_CURATION_SOURCE_TEXT_MAX_CHARS", "3000"))
MAX_SNIPPET_CHARS = int(os.getenv("OPENAI_CURATION_SNIPPET_MAX_CHARS", "420"))
OPENAI_REQUEST_TIMEOUT_SECONDS = float(
    os.getenv("OPENAI_CURATION_REQUEST_TIMEOUT_SECONDS", "180")
)
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
    editorial_plan: AICurationPlanOutput,
    writing_output: AIWritingOutput,
    indexed_articles: dict[int, RawArticle],
) -> CurationOutput:
    writing_by_topic = {
        story.canonical_topic.strip().lower(): story
        for story in writing_output.stories
    }
    curated_articles: list[CuratedArticle] = []

    for planned_story in editorial_plan.stories:
        topic_key = planned_story.canonical_topic.strip().lower()
        story = writing_by_topic.get(topic_key)
        if story is None:
            raise ValueError(
                f"Writer nao retornou texto para canonical_topic do plano: {planned_story.canonical_topic}"
            )

        source_ids = list(dict.fromkeys(planned_story.source_ids))
        if planned_story.primary_source_id not in source_ids:
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
                    is_primary=source_id == planned_story.primary_source_id,
                )
            )

        if len(resolved_sources) < 1 or len(resolved_sources) > 5:
            raise ValueError("Cada matéria precisa consolidar entre 1 e 5 fontes")

        primary_source = indexed_articles[planned_story.primary_source_id]
        curated_articles.append(
            CuratedArticle(
                title=primary_source.title,
                title_ptbr=story.title_ptbr.strip() if story.title_ptbr else None,
                url=primary_source.url,
                summary_ptbr=story.summary_ptbr.strip(),
                content_ptbr=story.content_ptbr.strip(),
                source=primary_source.source,
                category=planned_story.category,
                original_language=planned_story.original_language,
                reading_time_min=story.reading_time_min,
                canonical_topic=planned_story.canonical_topic.strip(),
                source_count=len(resolved_sources),
                primary_source_url=primary_source.url,
                primary_source_label=primary_source.source,
                source_published_at=primary_source.published_at,
                story_kind=planned_story.story_kind,
                source_items=resolved_sources,
            )
        )

    return CurationOutput(
        edition_summary=writing_output.edition_summary.strip(),
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
        if article.source_count < 1:
            raise ValueError("Todas as matérias precisam ter ao menos 1 fonte")

        topic_key = (article.canonical_topic or article.title_ptbr or article.title).strip().lower()
        if topic_key in topic_keys:
            raise ValueError("Curadoria retornou temas duplicados")
        topic_keys.add(topic_key)


def _validate_triage(output: AITriageOutput, indexed_articles: dict[int, RawArticle]) -> None:
    if not output.candidate_topics:
        raise ValueError("Triagem nao retornou temas candidatos")
    if len(output.candidate_topics) > 12:
        raise ValueError("Triagem retornou mais de 12 temas candidatos")

    seen_topics: set[str] = set()
    for topic in output.candidate_topics:
        topic_key = topic.canonical_topic.strip().lower()
        if topic_key in seen_topics:
            raise ValueError("Triagem retornou canonical_topic duplicado")
        seen_topics.add(topic_key)

        source_ids = list(dict.fromkeys(topic.source_ids))
        if source_ids != topic.source_ids:
            raise ValueError("Triagem retornou source_ids duplicados")
        if len(source_ids) > 6:
            raise ValueError("Triagem excedeu o limite de 6 fontes por tema")

        for source_id in source_ids:
            if source_id not in indexed_articles:
                raise ValueError(f"Triagem retornou source_id inexistente: {source_id}")


def _validate_plan(plan: AICurationPlanOutput, indexed_articles: dict[int, RawArticle]) -> None:
    story_count = len(plan.stories)
    if story_count < MIN_STORIES or story_count > MAX_STORIES:
        raise ValueError(
            f"Plano editorial precisa retornar entre {MIN_STORIES} e {MAX_STORIES} histórias; recebeu {story_count}"
        )
    if not plan.edition_angle_ptbr.strip():
        raise ValueError("Plano editorial retornou edition_angle_ptbr vazio")

    kinds = Counter(story.story_kind for story in plan.stories)
    if kinds.get("lead", 0) != 1:
        raise ValueError("Plano editorial precisa ter exatamente 1 lead")
    if not 2 <= kinds.get("secondary", 0) <= 3:
        raise ValueError("Plano editorial precisa ter de 2 a 3 secundárias")

    category_counts = Counter(story.category for story in plan.stories)
    category_overflow = [category for category, count in category_counts.items() if count > MAX_PER_CATEGORY]
    if category_overflow:
        raise ValueError("Plano excedeu limite por categoria: " + ", ".join(sorted(category_overflow)))

    seen_topics: set[str] = set()
    for story in plan.stories:
        topic_key = story.canonical_topic.strip().lower()
        if topic_key in seen_topics:
            raise ValueError("Plano editorial retornou temas duplicados")
        seen_topics.add(topic_key)

        source_ids = list(dict.fromkeys(story.source_ids))
        if source_ids != story.source_ids:
            raise ValueError("Plano editorial retornou source_ids duplicados")
        if len(source_ids) < 1 or len(source_ids) > 5:
            raise ValueError("Cada história precisa usar entre 1 e 5 fontes")
        if story.primary_source_id not in source_ids:
            raise ValueError("primary_source_id precisa estar dentro de source_ids")
        if story.target_paragraphs < 1 or story.target_paragraphs > 4:
            raise ValueError("target_paragraphs fora do intervalo esperado")
        if not story.editorial_angle_ptbr.strip() or not story.why_it_matters_ptbr.strip():
            raise ValueError("Plano editorial sem angulo editorial suficiente")
        if not story.must_include_facts:
            raise ValueError("Plano editorial precisa listar fatos obrigatórios")

        for source_id in source_ids:
            if source_id not in indexed_articles:
                raise ValueError(f"Plano editorial retornou source_id inexistente: {source_id}")


def _validate_writing_output(writing: AIWritingOutput, plan: AICurationPlanOutput) -> None:
    if not writing.edition_summary.strip():
        raise ValueError("Writer retornou edition_summary vazio")

    expected_topics = {story.canonical_topic.strip().lower() for story in plan.stories}
    returned_topics: set[str] = set()

    if len(writing.stories) != len(plan.stories):
        raise ValueError("Writer retornou quantidade de histórias diferente do plano")

    for story in writing.stories:
        topic_key = story.canonical_topic.strip().lower()
        if topic_key not in expected_topics:
            raise ValueError(f"Writer retornou canonical_topic fora do plano: {story.canonical_topic}")
        if topic_key in returned_topics:
            raise ValueError("Writer retornou canonical_topic duplicado")
        returned_topics.add(topic_key)

        if not story.summary_ptbr.strip() or not story.content_ptbr.strip():
            raise ValueError("Writer retornou historia sem summary ou content")


def _build_articles_payload(indexed_articles: dict[int, RawArticle], *, include_full_text: bool) -> list[dict]:
    payload = []

    for source_id, article in indexed_articles.items():
        item = {
            "id": source_id,
            "title": article.title,
            "url": article.url,
            "source": article.source,
            "collector": article.collector,
        }
        snippet = _truncate_text(article.snippet, max_chars=MAX_SNIPPET_CHARS)
        if snippet:
            item["snippet"] = snippet
        if article.published_at:
            item["published_at"] = article.published_at.isoformat()
        read_status = article.metadata.get("read_status")
        if read_status:
            item["read_status"] = read_status
        read_chars = article.metadata.get("read_chars")
        if read_chars:
            item["read_chars"] = read_chars
        if include_full_text and article.full_text:
            item["full_text_excerpt"] = _truncate_text(
                article.full_text,
                max_chars=MAX_SOURCE_TEXT_CHARS,
            )
        payload.append(item)

    return payload


def _collect_candidate_source_ids(triage: AITriageOutput) -> set[int]:
    source_ids: set[int] = set()
    for topic in triage.candidate_topics:
        source_ids.update(topic.source_ids)
    return source_ids


def _collect_planned_source_ids(plan: AICurationPlanOutput) -> set[int]:
    source_ids: set[int] = set()
    for story in plan.stories:
        source_ids.update(story.source_ids)
    return source_ids


def _supports_reasoning(model: str) -> bool:
    model_name = model.lower()
    return model_name.startswith(("gpt-5", "o1", "o3", "o4"))


def _truncate_text(value: str | None, *, max_chars: int) -> str | None:
    if not value:
        return None

    compact = " ".join(value.split())
    if len(compact) <= max_chars:
        return compact

    truncated = compact[:max_chars].rsplit(" ", 1)[0].strip()
    return truncated or compact[:max_chars].strip()


def _format_usage_summary(response) -> str | None:
    usage = getattr(response, "usage", None)
    if usage is None:
        return None

    input_tokens = getattr(usage, "input_tokens", None)
    output_tokens = getattr(usage, "output_tokens", None)
    total_tokens = getattr(usage, "total_tokens", None)
    parts = []
    if input_tokens is not None:
        parts.append(f"input_tokens={input_tokens}")
    if output_tokens is not None:
        parts.append(f"output_tokens={output_tokens}")
    if total_tokens is not None:
        parts.append(f"total_tokens={total_tokens}")
    return ", ".join(parts) if parts else None


def _parse_with_model(
    client: OpenAI,
    *,
    stage_name: str,
    model: str,
    reasoning_effort: str | None,
    system_prompt: str,
    user_prompt: str,
    schema,
):
    prompt_chars = len(system_prompt) + len(user_prompt)
    logger.info(
        f"[Curator] {stage_name}: model={model}, prompt_chars={prompt_chars}, "
        f"timeout={OPENAI_REQUEST_TIMEOUT_SECONDS:.0f}s"
    )

    request = {
        "model": model,
        "instructions": system_prompt,
        "input": user_prompt,
        "text_format": schema,
        "timeout": OPENAI_REQUEST_TIMEOUT_SECONDS,
    }
    if reasoning_effort and _supports_reasoning(model):
        request["reasoning"] = {"effort": reasoning_effort}

    response = client.responses.parse(**request)
    usage_summary = _format_usage_summary(response)
    if usage_summary:
        logger.info(f"[Curator] {stage_name}: {usage_summary}")
    if response.output_parsed is None:
        raise ValueError("Modelo retornou resposta sem output_parsed")
    return response.output_parsed


def _run_triage(client: OpenAI, indexed_articles: dict[int, RawArticle]) -> AITriageOutput:
    prompt = build_triage_prompt(_build_articles_payload(indexed_articles, include_full_text=False))
    logger.info(f"[Curator] Rodando triagem com {TRIAGE_MODEL}")
    output = _parse_with_model(
        client,
        stage_name="Triagem",
        model=TRIAGE_MODEL,
        reasoning_effort=TRIAGE_REASONING,
        system_prompt=TRIAGE_SYSTEM,
        user_prompt=prompt,
        schema=AITriageOutput,
    )
    _validate_triage(output, indexed_articles)
    return output


def _run_editorial_plan(
    client: OpenAI,
    triage: AITriageOutput,
    indexed_articles: dict[int, RawArticle],
) -> AICurationPlanOutput:
    candidate_ids = _collect_candidate_source_ids(triage)
    candidate_articles = {
        source_id: indexed_articles[source_id]
        for source_id in candidate_ids
        if source_id in indexed_articles
    }
    prompt = build_editorial_plan_prompt(
        [topic.model_dump() for topic in triage.candidate_topics],
        _build_articles_payload(candidate_articles, include_full_text=True),
    )
    logger.info(f"[Curator] Montando plano editorial com {EDITOR_MODEL}")
    output = _parse_with_model(
        client,
        stage_name="Plano editorial",
        model=EDITOR_MODEL,
        reasoning_effort=EDITOR_REASONING,
        system_prompt=EDITORIAL_PLAN_SYSTEM,
        user_prompt=prompt,
        schema=AICurationPlanOutput,
    )
    _validate_plan(output, indexed_articles)
    return output


def _run_writer(
    client: OpenAI,
    editorial_plan: AICurationPlanOutput,
    indexed_articles: dict[int, RawArticle],
) -> AIWritingOutput:
    planned_ids = _collect_planned_source_ids(editorial_plan)
    planned_articles = {
        source_id: indexed_articles[source_id]
        for source_id in planned_ids
        if source_id in indexed_articles
    }
    prompt = build_writing_prompt(
        editorial_plan.model_dump(),
        _build_articles_payload(planned_articles, include_full_text=True),
    )
    logger.info(f"[Curator] Escrevendo edição com {WRITER_MODEL}")
    output = _parse_with_model(
        client,
        stage_name="Redacao final",
        model=WRITER_MODEL,
        reasoning_effort=WRITER_REASONING,
        system_prompt=WRITER_SYSTEM,
        user_prompt=prompt,
        schema=AIWritingOutput,
    )
    _validate_writing_output(output, editorial_plan)
    return output


def _run_stage(stage_name: str, operation):
    for attempt in range(1, MAX_RETRIES + 1):
        started_at = monotonic()
        logger.info(f"[Curator] {stage_name}: tentativa {attempt}/{MAX_RETRIES}")

        try:
            result = operation()
            elapsed = monotonic() - started_at
            logger.info(f"[Curator] {stage_name}: concluida em {elapsed:.1f}s")
            return result
        except ValueError as exc:
            elapsed = monotonic() - started_at
            logger.warning(
                f"[Curator] {stage_name}: output invalido na tentativa "
                f"{attempt}/{MAX_RETRIES} apos {elapsed:.1f}s: {exc}"
            )
            if attempt == MAX_RETRIES:
                raise RuntimeError(
                    f"{stage_name} retornou output invalido apos {MAX_RETRIES} tentativa(s)"
                ) from exc
        except Exception as exc:
            elapsed = monotonic() - started_at
            logger.error(
                f"[Curator] {stage_name}: falha na tentativa "
                f"{attempt}/{MAX_RETRIES} apos {elapsed:.1f}s: {exc}"
            )
            if attempt == MAX_RETRIES:
                raise


def _run_writer_stage(
    client: OpenAI,
    editorial_plan: AICurationPlanOutput,
    indexed_articles: dict[int, RawArticle],
) -> CurationOutput:
    writing_output = _run_writer(client, editorial_plan, indexed_articles)
    result = _resolve_output(editorial_plan, writing_output, indexed_articles)
    _validate_curation(result)
    return result


def curate(raw_articles: list[RawArticle]) -> CurationOutput:
    """
    Recebe a lista bruta de artigos coletados e retorna os melhores
    selecionados e escritos em um pipeline editorial multi-etapas.
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

    triage = _run_stage("Triagem", lambda: _run_triage(client, indexed_articles))
    triage_source_ids = _collect_candidate_source_ids(triage)

    logger.info(
        f"[Curator] Triagem aprovou {len(triage.candidate_topics)} tema(s) e "
        f"{len(triage_source_ids)} fonte(s) para leitura aprofundada"
    )

    indexed_articles = enrich_articles(
        indexed_articles,
        triage_source_ids,
        max_chars=MAX_SOURCE_TEXT_CHARS,
    )
    editorial_plan = _run_stage(
        "Plano editorial",
        lambda: _run_editorial_plan(client, triage, indexed_articles),
    )
    result = _run_stage(
        "Redacao final",
        lambda: _run_writer_stage(client, editorial_plan, indexed_articles),
    )

    logger.info(f"[Curator] {len(result.articles)} matérias editoriais selecionadas pela IA")
    return result
