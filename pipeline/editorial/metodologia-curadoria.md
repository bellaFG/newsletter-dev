# Metodologia de curadoria

## Fase 1 - Leitura ampla

Passe por todas as fontes da semana antes de decidir a pauta. Procure movimentos, nao apenas links isolados: temas que aparecem em multiplas fontes, mudancas de plataforma, incidentes, releases substanciais, benchmarks, sinais de adocao ou abandono e discussoes que apontam dor real de desenvolvedores.

Um item singular tambem pode ser importante se tiver consequencia grande: vulnerabilidade relevante, mudanca de preco, deprecation, ruptura de compatibilidade, decisao regulatoria, incidentes de infraestrutura ou release que altera o modo como times constroem software.

## Fase 2 - Leitura adversarial

Para cada topico candidato, responda mentalmente:

1. Quem se beneficia desta noticia ser relatada dessa forma?
2. Qual e o fato verificavel e qual e a narrativa ou interpretacao?
3. Se eu fosse o leitor do DevPulse, o que eu gostaria de saber que a fonte nao disse?
4. Isso tem consequencia pratica em workflow, custo, risco, seguranca, arquitetura ou decisao tecnica?
5. A evidencia e solida, como release oficial, benchmark metodologico ou incidente documentado, ou e fraca, como rumor, opiniao ou adocao anedotica?

## Fase 3 - Ranking

Para cada topico candidato, atribua:

- `impact_score` de 1 a 10: tamanho da consequencia para devs e times.
- `novelty_score` de 1 a 10: quanto ha de novo, diferente ou ainda pouco absorvido.
- `developer_urgency_score` de 1 a 10: quao rapido o leitor precisa saber disso.
- `priority_score` de 0 a 100: prioridade editorial combinada, considerando tambem evidencia e qualidade das fontes.

Corte qualquer topico que nao sustente pelo menos 220 palavras de substancia real. Se so ha material para uma nota vaga, um resumo obvio ou uma frase de hype, o topico nao entra.

## Fase 4 - Distribuicao

Monte uma edicao com:

- 1 lead: a materia que define a semana.
- 2 a 3 secondary: materias que completam o quadro principal.
- 2 a 4 briefs: sinais curtos, mas ainda densos.

Nao repita a mesma categoria mais de duas vezes. Prefira fonte primaria quando existir. Reddit, Hacker News e agregadores podem apoiar a leitura editorial, mas so devem ser ancora quando a propria discussao da comunidade for a noticia.
