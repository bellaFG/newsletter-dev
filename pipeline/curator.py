import json
import os
from openai import OpenAI
from pydantic import ValidationError
from loguru import logger

from pipeline.models import RawArticle, CurationOutput
from pipeline.prompts import CURATION_SYSTEM, build_curation_prompt

MODEL = "gpt-4o-mini"
MAX_RETRIES = 3


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
        if a.url not in seen_urls:
            seen_urls.add(a.url)
            unique_articles.append(a)

    logger.info(f"[Curator] {len(raw_articles)} artigos coletados → {len(unique_articles)} únicos após deduplicação")

    articles_payload = [
        {"title": a.title, "url": a.url, "snippet": a.snippet, "source": a.source}
        for a in unique_articles
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
            result = CurationOutput.model_validate(data)

            logger.info(f"[Curator] {len(result.articles)} artigos selecionados pela IA")
            return result

        except ValidationError as e:
            logger.warning(f"[Curator] Output inválido na tentativa {attempt}: {e}")
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"IA retornou JSON inválido após {MAX_RETRIES} tentativas") from e

        except Exception as e:
            logger.error(f"[Curator] Erro na tentativa {attempt}: {e}")
            if attempt == MAX_RETRIES:
                raise
