from datetime import datetime
from typing import Any, Literal

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
CollectorType = Literal["rss", "reddit", "github_trending"]
StoryKind = Literal["lead", "secondary", "brief"]
EstimatedDepth = Literal["raso", "medio", "profundo"]


class RawArticle(BaseModel):
    """Artigo coletado das fontes — antes da curadoria IA."""

    title: str
    url: str
    snippet: str  # trecho bruto do conteúdo ou descrição do feed
    source: str  # ex: "Hacker News", "GitHub Trending"
    published_at: datetime | None = None
    collected_at: datetime = Field(default_factory=datetime.utcnow)
    collector: CollectorType | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    full_text: str | None = None


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
    source_published_at: datetime | None = None
    story_kind: StoryKind | None = None
    source_items: list[ArticleSource] = Field(default_factory=list)


class AICurationCandidateTopic(BaseModel):
    """Tema candidato identificado pela triagem inicial."""

    canonical_topic: str
    category: ArticleCategory
    source_ids: list[int]
    priority_score: int = Field(ge=0, le=100)
    impact_score: int = Field(ge=1, le=10)
    novelty_score: int = Field(ge=1, le=10)
    developer_urgency_score: int = Field(ge=1, le=10)
    adversarial_notes_ptbr: str | None = None
    estimated_depth: EstimatedDepth | None = None
    why_it_matters_ptbr: str
    critical_question_ptbr: str


class AITriageOutput(BaseModel):
    """Saída da etapa barata: temas candidatos e ranking preliminar."""

    candidate_topics: list[AICurationCandidateTopic]


class AICurationPlanStory(BaseModel):
    """Plano editorial final antes da redação."""

    canonical_topic: str
    category: ArticleCategory
    story_kind: StoryKind
    primary_source_id: int
    source_ids: list[int]
    title_angle_ptbr: str
    why_it_matters_ptbr: str
    editorial_angle_ptbr: str
    must_include_facts: list[str] = Field(default_factory=list)
    target_paragraphs: int = Field(ge=3, le=6)
    original_language: str = "en"


class AICurationPlanOutput(BaseModel):
    """Plano da edição: o que entra, em que ordem e com qual ângulo."""

    edition_angle_ptbr: str
    stories: list[AICurationPlanStory]


class AIWrittenStory(BaseModel):
    """Texto final redigido para um tópico aprovado no plano editorial."""

    canonical_topic: str
    title_ptbr: str | None = None
    summary_ptbr: str
    content_ptbr: str
    reading_time_min: int | None = None


class AIWritingOutput(BaseModel):
    """Saída final do redator: resumo da edição e textos das matérias."""

    edition_summary: str
    stories: list[AIWrittenStory]


class CurationOutput(BaseModel):
    """Output completo da IA com a lista de artigos curados."""

    edition_summary: str
    articles: list[CuratedArticle]
