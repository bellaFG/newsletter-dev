# DevPulse

> **[newsletter-dev.vercel.app](https://newsletter-dev.vercel.app)**

Newsletter semanal curada por IA para desenvolvedores brasileiros.

**Astro 5** | **Supabase** | **Brevo** | **OpenAI** | **Vercel**

---

## Visao Geral

DevPulse coleta artigos de diversas fontes (RSS, GitHub Trending, Reddit), faz uma triagem inicial barata, le as fontes candidatas e monta a curadoria final com modelos mais fortes antes de publicar toda segunda-feira por email e no site.

O projeto tem duas partes independentes:

- **Web** (Astro SSR) — Site publico com as edicoes, formulario de inscricao, e API de envio
- **Pipeline** (Python) — Coleta, curadoria por IA, publicacao no banco e disparo dos emails

---

## Arquitetura

```
                  +------------------+
                  |  GitHub Actions  |
                  | (prepare/check/  |
                  | publish toda seg)|
                  +--------+---------+
                           |
                  +--------v---------+
                  |  Pipeline Python  |
                  |  (coleta + IA)    |
                  +--------+---------+
                           |
              +------------+------------+
              |                         |
    +---------v----------+    +---------v----------+
    |     Supabase       |    |   API /send-newsletter
    |  (PostgreSQL + RLS)|    |   (Astro SSR)      |
    +--------+-----------+    +---------+----------+
             |                          |
    +--------v-----------+    +---------v----------+
    |   Site Publico     |    |     Brevo          |
    |   (Astro SSR)      |    |   (SMTP email)     |
    +--------------------+    +--------------------+
```

---

## Stack Tecnologico

| Camada | Tecnologia |
|--------|-----------|
| Framework web | Astro 5 (SSR) |
| Estilizacao | Tailwind CSS 3.4 + oklch color tokens |
| Email template | React Email |
| Envio de email | Brevo (ex-Sendinblue) API |
| Banco de dados | Supabase (PostgreSQL + RLS) |
| Curadoria IA | OpenAI GPT-5.4 mini + GPT-5.4 |
| Pipeline | Python 3.11 (feedparser, requests, BeautifulSoup, Pydantic) |
| Deploy web | Vercel |
| Automacao | GitHub Actions (prepare + check + publish) |

---

## Estrutura do Projeto

```
newsletter/
|
|-- src/
|   |-- pages/
|   |   |-- index.astro              # Homepage: edicao atual + busca + subscribe
|   |   |-- archive.astro            # Todas as edicoes por ano
|   |   |-- [slug].astro             # Detalhe de uma edicao
|   |   |-- unsubscribe.astro        # Cancelamento de inscricao
|   |   |-- 404.astro                # Pagina de erro 404
|   |   |-- categoria/
|   |   |   +-- [category].astro     # Arquivo por categoria
|   |   |-- edicao/
|   |   |   +-- [slug]/
|   |   |       +-- [articleSlug].astro # Detalhe de um artigo
|   |   +-- api/
|   |       |-- subscribe.ts         # POST: registrar subscriber
|   |       +-- send-newsletter.ts   # POST: enviar emails (autenticado)
|   |
|   |-- layouts/
|   |   +-- Layout.astro             # Layout base (fonts, tema, meta tags, modal)
|   |
|   |-- components/
|   |   |-- ArticleCard.astro        # Card de artigo na grid
|   |   |-- CategoryNav.astro        # Navegacao por categorias (pills/links)
|   |   |-- CompactMasthead.astro    # Masthead de paginas internas
|   |   |-- CategoryDivider.astro    # Divisor estilo jornal
|   |   |-- SectionHeader.astro      # Cabecalho de secao
|   |   +-- PageFooterNav.astro      # Rodape de navegacao
|   |
|   |-- lib/
|   |   |-- config.ts                # Constantes centralizadas do site
|   |   |-- env.ts                   # Validacao de variaveis de ambiente
|   |   |-- supabase.ts              # Clientes Supabase (anon + server)
|   |   |-- brevo.ts                 # Cliente Brevo (envio de email)
|   |   |-- types.ts                 # Tipos TypeScript do banco
|   |   |-- articles.ts              # Agrupamento e ordenacao de artigos
|   |   +-- date.ts                  # Formatacao de datas pt-BR
|   |
|   +-- styles/
|       +-- globals.css              # Tailwind + CSS variables (light/dark)
|
|-- emails/
|   +-- NewsletterEmail.tsx          # Template de email (React Email)
|
|-- pipeline/
|   |-- main.py                      # Orquestrador: prepare -> check-ready -> publish
|   |-- curator.py                   # Curadoria em 3 etapas (triagem, pauta, redacao)
|   |-- article_reader.py            # Leitura/enriquecimento das fontes aprovadas
|   |-- publisher.py                 # Prepara rascunho + publica + dispara email
|   |-- notifications.py             # Alertas operacionais via Discord webhook
|   |-- models.py                    # Modelos Pydantic
|   |-- prompts.py                   # Prompts por etapa editorial
|   |-- sources.yaml                 # Fontes de artigos (RSS, Reddit, GitHub)
|   |-- requirements.txt             # Dependencias Python
|   +-- collectors/
|       |-- rss.py                   # Coletor RSS (10 feeds)
|       |-- github_trending.py       # Coletor GitHub Trending
|       +-- reddit.py                # Coletor Reddit (6 subreddits)
|
|-- supabase/
|   |-- config.toml                  # Configuracao local do Supabase CLI
|   |-- .gitignore                   # Ignora arquivos gerados pelo CLI
|   |-- schema.sql                   # Schema do banco + politicas RLS
|   +-- migrations/
|       +-- 20260420143000_initial_schema.sql # Baseline oficial do schema via Supabase CLI
|
|-- public/
|   +-- fonts/                       # Geist Sans e Geist Mono (woff)
|
+-- .github/
    +-- workflows/
        +-- newsletter.yml           # GitHub Actions: cron toda segunda
```

---

## Configuracao Local

### Pre-requisitos

- Node.js 18+
- Python 3.11+
- Supabase CLI 2.x ou `npx --yes supabase`
- Conta no [Supabase](https://supabase.com) (plano gratuito)
- Conta no [Brevo](https://brevo.com) (plano gratuito — 300 emails/dia)
- Chave da API [OpenAI](https://platform.openai.com) (para o pipeline)

### 1. Clone e instale

```bash
git clone https://github.com/seu-usuario/newsletter.git
cd newsletter
npm install
```

### 2. Configure as variaveis de ambiente

```bash
cp .env.example .env.local
```

Preencha todas as variaveis no `.env.local`. Veja a secao [Variaveis de Ambiente](#variaveis-de-ambiente) para detalhes.

### 3. Configure o banco de dados

O fluxo oficial agora usa o **Supabase CLI**.

Primeira configuracao do repositorio:

```bash
npm run supabase:login
npm run supabase:link -- --project-ref <seu-project-ref>
```

O `project-ref` e o identificador curto do projeto no dashboard do Supabase. No passo de `link`, o CLI pede a senha do banco e salva isso no proprio ambiente do Supabase CLI.

Para aplicar as migrations remotas do projeto:

```bash
npm run migrate:db
```

O comando acima e um alias para `supabase db push`.

Se o banco remoto ja recebeu alteracoes manuais antes da adocao do CLI, rode `supabase db pull` primeiro e revise a migration gerada antes de continuar.

### 4. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

O site estara disponivel em `http://localhost:4321`.

### 5. (Opcional) Execute o pipeline localmente

```bash
cd pipeline
pip install -r requirements.txt
cd ..
python -m pipeline.main
```

---

## Pipeline Python

O pipeline roda automaticamente toda segunda-feira via GitHub Actions, mas pode ser executado manualmente.

### Fluxo

1. **Prepare (07:00 BRT)** — Busca artigos, roda triagem + leitura + curadoria e salva um rascunho pronto no Supabase
2. **Check-ready (07:30 BRT)** — Verifica se a edicao ficou pronta 30 minutos antes da publicacao; se nao, alerta no Discord
3. **Publish (08:00 BRT)** — Publica a edicao no site e chama `POST /api/send-newsletter`

### Curadoria editorial

O pipeline editorial agora e separado em tres etapas:

1. **Triagem** — um modelo menor (`gpt-5.4-mini` por padrao) filtra ruido, agrupa temas parecidos e monta uma fila de pautas candidatas.
2. **Leitura** — o pipeline busca o texto completo das fontes candidatas para que a etapa forte leia mais do que apenas titulo + snippet.
3. **Pauta + redacao** — um modelo forte (`gpt-5.4` por padrao) decide a edicao final e escreve cada materia com angulo editorial claro.

Isso melhora a qualidade porque a IA forte deixa de gastar contexto com lixo, recebe material lido das fontes relevantes e passa a atuar mais como editor do que como classificador.

### Fontes configuradas (`pipeline/sources.yaml`)

| Tipo | Fontes |
|------|--------|
| RSS | Hacker News, The Changelog, InfoQ, dev.to, Lobste.rs, Martin Fowler, ThoughtWorks Radar, The Verge, Ars Technica, GitHub Blog |
| GitHub | Trending (all, Python, TypeScript, Go, Rust) |
| Reddit | r/programming, r/webdev, r/MachineLearning, r/devops, r/golang, r/rust |

---

## Variaveis de Ambiente

| Variavel | Obrigatoria | Usada por | Descricao |
|----------|:-----------:|-----------|-----------|
| `SUPABASE_URL` | Sim | Web + Pipeline | URL da instancia Supabase |
| `SUPABASE_ANON_KEY` | Sim | Web | Chave anonima (client publico) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Web + Pipeline | Chave service role (bypassa RLS) |
| `BREVO_API_KEY` | Sim | Web | Chave da API Brevo |
| `DISCORD_ALERT_WEBHOOK_URL` | Nao | Pipeline | Webhook do Discord para alertas operacionais |
| `NEWSLETTER_API_SECRET` | Sim | Web + Pipeline | Token Bearer para `/api/send-newsletter` |
| `OPENAI_API_KEY` | Sim | Pipeline | Chave da API OpenAI |
| `OPENAI_CURATION_TRIAGE_MODEL` | Nao | Pipeline | Modelo barato da triagem inicial (padrao: `gpt-5.4-nano`) |
| `OPENAI_CURATION_EDITOR_MODEL` | Nao | Pipeline | Modelo forte para decidir a pauta final (padrao: `gpt-5.4`) |
| `OPENAI_CURATION_WRITER_MODEL` | Nao | Pipeline | Modelo de redacao final com bom custo/qualidade (padrao: `gpt-5.4-mini`) |
| `OPENAI_CURATION_TRIAGE_REASONING` | Nao | Pipeline | Esforco de raciocinio da triagem (padrao: `low`) |
| `OPENAI_CURATION_EDITOR_REASONING` | Nao | Pipeline | Esforco de raciocinio da etapa editorial (padrao: `medium`) |
| `OPENAI_CURATION_WRITER_REASONING` | Nao | Pipeline | Esforco de raciocinio da redacao final (padrao: `low`) |
| `OPENAI_CURATION_SOURCE_TEXT_MAX_CHARS` | Nao | Pipeline | Limite de caracteres lidos por fonte aprovada na triagem |
| `OPENAI_CURATION_MAX_RETRIES` | Nao | Pipeline | Numero de tentativas em caso de output invalido |
| `SITE_URL` | Sim | Pipeline | URL base do site (ex: `https://devpulse.com.br`) |

---

## Deploy

### Web (Vercel)

O projeto esta deployado em **[newsletter-dev.vercel.app](https://newsletter-dev.vercel.app)** usando o adapter `@astrojs/vercel`.

**Configuracao no painel do Vercel:**
- **Framework Preset**: Astro
- **Build Command**: `npm run build`
- **Output Directory**: (vazio — o adapter gerencia automaticamente)

Para configurar em um novo projeto:
1. Conecte o repositorio ao Vercel
2. Selecione **Astro** como framework preset
3. Configure as variaveis de ambiente no painel

### Pipeline (GitHub Actions)

O workflow `.github/workflows/newsletter.yml` roda automaticamente:

- **07:00 BRT**: prepara o rascunho da edicao da semana
- **07:30 BRT**: verifica se o rascunho esta pronto e alerta no Discord se nao estiver
- **08:00 BRT**: publica no site e envia os emails
- **Trigger manual**: Tambem pode ser disparado via `workflow_dispatch` com escolha de modo

Configure as secrets no repositorio GitHub:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF`
- `OPENAI_API_KEY`
- `BREVO_API_KEY`
- `DISCORD_ALERT_WEBHOOK_URL`
- `NEWSLETTER_API_SECRET`
- `SITE_URL`

Com essas secrets definidas, cada job roda `supabase link` + `supabase db push` antes de executar `prepare`, `check-ready`, `publish` ou `full`.

---

## Seguranca

### Autenticacao da API

O endpoint `POST /api/send-newsletter` requer um header `Authorization: Bearer {NEWSLETTER_API_SECRET}`. A comparacao do token usa `timingSafeEqual` para prevenir timing attacks. Apenas o pipeline Python e chamadas autorizadas podem disparar o envio.

### Row Level Security (RLS)

Todas as tabelas tem RLS habilitado no Supabase:

- **editions/articles**: Leitura publica (site), escrita apenas via service role (pipeline)
- **subscribers**: Insercao anonima (formulario), leitura/atualizacao via service role. Anon **nao pode** SELECT, prevenindo exfiltracao de emails

### Protecao contra enumeracao

O endpoint `POST /api/subscribe` retorna a mesma resposta (200 + success) independente de o email ja existir, estar inativo ou ser novo, impedindo que atacantes descubram quais emails estao cadastrados.

### Validacao de email

Alem de validacao por regex (RFC 5322), o endpoint verifica registros MX/A do dominio via DNS para rejeitar dominios inexistentes.

### Idempotencia no envio

O endpoint de envio verifica se `sent_at` ja esta preenchido antes de enviar. Se a edicao ja foi enviada, retorna sucesso sem reenviar, prevenindo duplicatas.

### Limitacoes conhecidas

- O link de unsubscribe usa o email diretamente na URL (nao e assinado criptograficamente). Qualquer pessoa com o email pode cancelar a inscricao de outro usuario. Para maior seguranca, considerar HMAC-signed tokens no futuro.

---

## Scripts Disponiveis

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento (porta 4321) |
| `npm run build` | Gera build de producao |
| `npm run preview` | Preview local do build de producao |
| `npm run lint` | Verifica tipos com `astro check` |
| `npm run supabase:login` | Executa o login oficial do Supabase CLI |
| `npm run supabase:link -- --project-ref <ref>` | Vincula o repo ao projeto remoto do Supabase |
| `npm run migrate:list` | Lista o historico local/remoto de migrations |
| `npm run migrate:db` | Executa `supabase db push` com as migrations oficiais |

---

## Licenca

MIT
