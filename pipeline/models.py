from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ArticleCategory = Literal[
    "Backend",
    "Frontend",
    "IA & Machine Learning",
    "DevOps & Cloud",
    "Segurança",
    "Open Source",
    "Ferramentas & Produtividade",
    "Carreira & Cultura",
    "Linguagens & Frameworks",
]


class RawArticle(BaseModel):
    """Artigo coletado das fontes — antes da curadoria IA."""

    title: str
    url: str
    snippet: str  # trecho bruto do conteúdo ou descrição do feed
    source: str  # ex: "Hacker News", "GitHub Trending"
    collected_at: datetime = None

    def model_post_init(self, __context):
        if self.collected_at is None:
            self.collected_at = datetime.utcnow()


class ArticleSource(BaseModel):
    """Fonte usada para compor uma matéria editorial."""

    label: str
    url: str
    title: str | None = None
    snippet: str | None = None
    is_primary: bool = False


class CuratedArticle(BaseModel):
    """Matéria editorial após curadoria da IA — pronta para salvar no banco."""

    title: str
    title_ptbr: str | None = None
    url: str
    summary_ptbr: str
    content_ptbr: str | None = None
    source: str
    category: ArticleCategory
    original_language: str = "en"
    reading_time_min: int | None = None
    canonical_topic: str | None = None
    source_count: int = 1
    primary_source_url: str | None = None
    primary_source_label: str | None = None
    source_items: list[ArticleSource] = Field(default_factory=list)


class AICuratedStory(BaseModel):
    """Estrutura esperada do LLM antes da resolução das fontes reais."""

    title_ptbr: str | None = None
    summary_ptbr: str
    content_ptbr: str
    category: ArticleCategory
    canonical_topic: str
    primary_source_id: int
    source_ids: list[int]
    original_language: str = "en"
    reading_time_min: int | None = None


class AICurationOutput(BaseModel):
    """Saída bruta do LLM: resumo da edição + stories e suas referências."""

    edition_summary: str
    stories: list[AICuratedStory]


class CurationOutput(BaseModel):
    """Output completo da IA com a lista de artigos curados."""

    edition_summary: str
    articles: list[CuratedArticle]
