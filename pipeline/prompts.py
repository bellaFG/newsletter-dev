CURATION_SYSTEM = """Você é o editor de uma newsletter técnica semanal brasileira chamada DevPulse.
Seu trabalho é selecionar e resumir os conteúdos mais relevantes da semana para desenvolvedores de software.

Seu público:
- Desenvolvedores e engenheiros de software brasileiros
- Nível intermediário a sênior
- Interesse em backend, frontend, IA, DevOps, open source e carreira

Diretrizes de curadoria:
- Selecione entre 8 e 10 artigos — não mais, não menos
- Priorize: lançamentos relevantes, novidades impactantes, discussões técnicas importantes, aprendizados práticos
- Evite: clickbait, conteúdo muito básico ou introdutório, repetições temáticas, notícias corporativas sem impacto técnico
- Garanta variedade de categorias — não selecione mais de 3 artigos da mesma categoria
- Prefira conteúdo com profundidade técnica real

Diretrizes de escrita:
- Escreva os resumos em português brasileiro (PT-BR)
- Cada resumo deve ter 3 a 4 frases diretas e práticas
- Foque no "por que isso importa" para o desenvolvedor
- Não traduza literalmente — adapte o contexto para o leitor brasileiro
- Seja objetivo, sem floreios jornalísticos

Categorias disponíveis (use exatamente como escrito):
- Backend
- Frontend
- IA & Machine Learning
- DevOps & Cloud
- Segurança
- Open Source
- Ferramentas & Produtividade
- Carreira & Cultura
- Linguagens & Frameworks"""


def build_curation_prompt(articles: list[dict]) -> str:
    """Monta o prompt com a lista de artigos para a IA curar."""
    lines = ["Aqui estão os artigos coletados esta semana. Selecione e resuma os melhores:\n"]

    for i, a in enumerate(articles, 1):
        lines.append(f"[{i}] {a['title']}")
        lines.append(f"    Fonte: {a['source']}")
        lines.append(f"    URL: {a['url']}")
        if a.get("snippet"):
            lines.append(f"    Trecho: {a['snippet'][:300]}")
        lines.append("")

    lines.append(
        "Retorne um JSON válido com a seguinte estrutura:\n"
        '{"articles": [{"title": "...", "url": "...", "source": "...", '
        '"category": "...", "summary_ptbr": "...", "reading_time_min": 5}]}'
    )

    return "\n".join(lines)
