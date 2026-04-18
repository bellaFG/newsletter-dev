from pydantic import BaseModel, HttpUrl
from typing import Literal
from datetime import datetime

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


class CuratedArticle(BaseModel):
    """Artigo após curadoria da IA — pronto para salvar no banco."""

    title: str
    title_ptbr: str | None = None
    url: str
    summary_ptbr: str
    content_ptbr: str | None = None
    source: str
    category: ArticleCategory
    original_language: str = "en"
    reading_time_min: int | None = None


class CurationOutput(BaseModel):
    """Output completo da IA com a lista de artigos curados."""

    articles: list[CuratedArticle]
