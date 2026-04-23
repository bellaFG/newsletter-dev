import json
from pathlib import Path

from pipeline.editorial_rules import describe_paragraph_limits, describe_word_limits

_EDITORIAL_DIR = Path(__file__).parent / "editorial"


def _load_doc(name: str) -> str:
    return (_EDITORIAL_DIR / f"{name}.md").read_text(encoding="utf-8").strip()


PERSONA_LEITOR = _load_doc("persona-leitor")
PERSONA_CURADOR = _load_doc("persona-curador")
METODOLOGIA_CURADORIA = _load_doc("metodologia-curadoria")
GUIA_REDACAO = _load_doc("guia-redacao")

TRIAGE_SYSTEM = f"""{PERSONA_CURADOR}

Voce esta na FASE DE TRIAGEM do DevPulse. Sua funcao nao e escrever a newsletter; e filtrar ruido, agrupar sinais parecidos e apontar o que merece leitura aprofundada.

Leitor-alvo:
{PERSONA_LEITOR}

Metodologia a seguir:
{METODOLOGIA_CURADORIA}

Nesta fase, aplique principalmente as Fases 1, 2 e 3. Retorne no maximo 12 topicos candidatos ranqueados. Nao escreva texto final de newsletter."""

EDITORIAL_PLAN_SYSTEM = f"""{PERSONA_CURADOR}

Voce esta na FASE DE PLANO EDITORIAL do DevPulse. Voce recebeu uma triagem inicial e material lido das fontes candidatas. Sua tarefa e decidir a pauta final da edicao.

Leitor-alvo:
{PERSONA_LEITOR}

Metodologia a seguir:
{METODOLOGIA_CURADORIA}

Nesta fase, aplique principalmente as Fases 3 e 4. Monte uma edicao de 5 a 8 materias, com 1 lead, 2 a 3 secondary e o restante brief. Corte temas com pouca evidencia, pouca profundidade ou pouco valor pratico."""

WRITER_SYSTEM = f"""{PERSONA_CURADOR}

Voce esta na FASE DE REDACAO FINAL do DevPulse. Escreva materias editoriais consolidadas a partir do plano e das fontes lidas. Voce nao esta resumindo links; esta construindo artigos completos, criticos e uteis para leitura no site.

Leitor-alvo:
{PERSONA_LEITOR}

Guia de redacao:
{GUIA_REDACAO}

Use apenas fatos suportados pelas fontes fornecidas. Diferencie fato e analise sem soar burocratico. O resumo do email deve ser curto; o conteudo completo do site deve ser mais rico e contextual."""


def build_triage_prompt(articles: list[dict]) -> str:
    payload = {
        "objective": (
            "Filtrar os itens coletados da semana e produzir uma lista ranqueada de temas "
            "candidatos para leitura aprofundada."
        ),
        "instructions": [
            "Retorne no maximo 12 temas candidatos.",
            "Agrupe source_ids do mesmo movimento em um unico topico.",
            "Use priority_score para ordenar por impacto editorial total.",
            "Preencha adversarial_notes_ptbr com uma sintese curta da leitura adversarial da Fase 2.",
            "estimated_depth deve ser 'medio' ou 'profundo' para todo topico retornado; corte topicos 'raso'.",
            "why_it_matters_ptbr deve dizer por que um dev deveria se importar nesta semana.",
            "critical_question_ptbr deve registrar o que ainda exige leitura critica ou verificacao.",
            "Nao retorne topico que nao sustente pelo menos 220 palavras de substancia real.",
            "Nao escreva texto final de newsletter.",
        ],
        "articles": articles,
    }

    return (
        "Analise a coleta abaixo e monte uma fila editorial de temas candidatos.\n"
        "Considere impacto, novidade, urgencia para devs e sinal tecnico real.\n\n"
        f"{_dump_json(payload)}"
    )


def build_editorial_plan_prompt(candidate_topics: list[dict], articles: list[dict]) -> str:
    payload = {
        "objective": "Montar a pauta final da edicao com angulo editorial, ordem e fontes.",
        "instructions": [
            "Escolha de 5 a 8 historias finais.",
            "Produza exatamente 1 story_kind='lead'.",
            "Produza de 2 a 3 story_kind='secondary'.",
            "Use 'brief' para o restante.",
            "source_ids deve ter de 1 a 5 ids reais.",
            "primary_source_id deve estar dentro de source_ids.",
            f"target_paragraphs deve seguir o peso editorial: {describe_paragraph_limits()}.",
            "must_include_facts precisa listar fatos verificaveis e concretos.",
            "Inclua fatos suficientes para sustentar um artigo completo: detalhes tecnicos, contexto, impacto pratico e limitacoes conhecidas.",
            "Use estimated_depth da triagem para cortar topicos rasos antes da pauta final.",
            "Corte historias fracas mesmo que tenham aparecido na triagem.",
        ],
        "candidate_topics": candidate_topics,
        "source_material": articles,
    }

    return (
        "Use a triagem e o material lido abaixo para decidir a edicao final.\n"
        "Procure o fio condutor da semana e monte uma pauta que um dev realmente queira ler.\n\n"
        f"{_dump_json(payload)}"
    )


def build_writing_prompt(plan: dict, articles: list[dict]) -> str:
    payload = {
        "objective": "Escrever a edicao final com resumo para email e artigos completos para o site.",
        "instructions": [
            "Respeite exatamente os canonical_topic do plano.",
            "edition_summary deve ter 2-3 frases e abrir a edicao sem listar tudo.",
            "summary_ptbr deve ter exatamente 2 frases.",
            "summary_ptbr e o inicio de content_ptbr nao devem ser o mesmo texto.",
            "title_ptbr deve colocar resultado e consequencia na frente.",
            "content_ptbr deve usar quebras de linha duplas entre paragrafos.",
            "content_ptbr deve entregar a leitura na integra: mais contexto, mais fatos, consequencias praticas, limitacoes e o que observar depois.",
            f"Respeite os limites de paragrafos: {describe_paragraph_limits()}.",
            f"Respeite os limites de palavras: {describe_word_limits()}.",
            "Estruture os paragrafos nesta ordem quando fizer sentido: o que aconteceu; contexto tecnico; impacto para devs/equipes; riscos ou limitacoes; leitura editorial/proximos passos.",
            "Nao invente dados nem extrapole alem do que as fontes permitem.",
            "Se as fontes nao trouxerem detalhe suficiente, deixe essa limitacao clara em vez de preencher lacunas.",
            "Consolide as fontes em uma narrativa unica em vez de enumerar links.",
        ],
        "plan": plan,
        "source_material": articles,
    }

    return (
        "Escreva a edicao final do DevPulse a partir do plano editorial e das fontes lidas.\n"
        "O resumo precisa continuar enxuto, mas content_ptbr deve ser a leitura completa no site.\n\n"
        f"{_dump_json(payload)}"
    )


def _dump_json(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
