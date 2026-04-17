# DevPulse

> **[newsletter-dev.vercel.app](https://newsletter-dev.vercel.app)**

Newsletter semanal curada por IA para desenvolvedores brasileiros.

**Astro 5** | **Supabase** | **Resend** | **OpenAI** | **Vercel**

---

## Visao Geral

DevPulse coleta artigos de diversas fontes (RSS, GitHub Trending, Reddit), seleciona e resume os mais relevantes usando IA (GPT-4o mini), e entrega toda segunda-feira por email para os assinantes.

O projeto tem duas partes independentes:

- **Web** (Astro SSR) — Site publico com as edicoes, formulario de inscricao, e API de envio
- **Pipeline** (Python) — Coleta, curadoria por IA, publicacao no banco e disparo dos emails

---

## Arquitetura

```
                  +------------------+
                  |  GitHub Actions  |
                  |  (cron: seg 8h)  |
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
    |   Site Publico     |    |     Resend         |
    |   (Astro SSR)      |    |   (batch email)    |
    +--------------------+    +--------------------+
```

---

## Stack Tecnologico

| Camada | Tecnologia |
|--------|-----------|
| Framework web | Astro 5 (SSR) |
| Estilizacao | Tailwind CSS 3.4 + oklch color tokens |
| Email template | React Email |
| Envio de email | Resend (batch API) |
| Banco de dados | Supabase (PostgreSQL + RLS) |
| Curadoria IA | OpenAI GPT-4o mini |
| Pipeline | Python 3.11 (feedparser, requests, BeautifulSoup, Pydantic) |
| Deploy web | Vercel |
| Automacao | GitHub Actions (cron semanal) |

---

## Estrutura do Projeto

```
newsletter/
|
|-- src/
|   |-- pages/
|   |   |-- index.astro              # Homepage: edicao atual + subscribe
|   |   |-- archive.astro            # Todas as edicoes por ano
|   |   |-- [slug].astro             # Detalhe de uma edicao
|   |   |-- unsubscribe.astro        # Cancelamento de inscricao
|   |   |-- 404.astro                # Pagina de erro 404
|   |   +-- api/
|   |       |-- subscribe.ts         # POST: registrar subscriber
|   |       +-- send-newsletter.ts   # POST: enviar emails (autenticado)
|   |
|   |-- layouts/
|   |   +-- Layout.astro             # Layout base (fonts, tema, meta tags)
|   |
|   |-- lib/
|   |   |-- config.ts                # Constantes centralizadas do site
|   |   |-- env.ts                   # Validacao de variaveis de ambiente
|   |   |-- supabase.ts              # Clientes Supabase (anon + server)
|   |   |-- resend.ts                # Cliente Resend
|   |   |-- types.ts                 # Tipos TypeScript do banco
|   |   |-- articles.ts              # Agrupamento e ordenacao de artigos
|   |   |-- date.ts                  # Formatacao de datas pt-BR
|   |   +-- utils.ts                 # Utilitario cn() para Tailwind
|   |
|   +-- styles/
|       +-- globals.css              # Tailwind + CSS variables (light/dark)
|
|-- emails/
|   +-- NewsletterEmail.tsx          # Template de email (React Email)
|
|-- pipeline/
|   |-- main.py                      # Orquestrador: coleta -> curadoria -> publicacao
|   |-- curator.py                   # Curadoria com GPT-4o mini
|   |-- publisher.py                 # Salva no Supabase + dispara email
|   |-- models.py                    # Modelos Pydantic
|   |-- prompts.py                   # System prompt da IA
|   |-- sources.yaml                 # Fontes de artigos (RSS, Reddit, GitHub)
|   |-- requirements.txt             # Dependencias Python
|   +-- collectors/
|       |-- rss.py                   # Coletor RSS (7 feeds)
|       |-- github_trending.py       # Coletor GitHub Trending
|       +-- reddit.py                # Coletor Reddit (4 subreddits)
|
|-- supabase/
|   +-- schema.sql                   # Schema do banco + politicas RLS
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
- Conta no [Supabase](https://supabase.com) (plano gratuito)
- Conta no [Resend](https://resend.com) (plano gratuito)
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

No Supabase Dashboard, va em **SQL Editor** e execute o conteudo de `supabase/schema.sql`. Isso cria as tabelas, indices e politicas RLS.

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

1. **Coleta** — Busca artigos de 7 feeds RSS, GitHub Trending (4 linguagens) e Reddit (4 subreddits)
2. **Curadoria** — GPT-4o mini seleciona 8-10 artigos, categoriza e gera resumos em pt-BR
3. **Publicacao** — Insere edicao e artigos no Supabase, depois chama `POST /api/send-newsletter`

### Fontes configuradas (`pipeline/sources.yaml`)

| Tipo | Fontes |
|------|--------|
| RSS | Hacker News, The Changelog, InfoQ, dev.to, Lobste.rs, Martin Fowler, ThoughtWorks Radar |
| GitHub | Trending (all, Python, TypeScript, Go) |
| Reddit | r/programming, r/webdev, r/MachineLearning, r/devops |

---

## Variaveis de Ambiente

| Variavel | Obrigatoria | Usada por | Descricao |
|----------|:-----------:|-----------|-----------|
| `SUPABASE_URL` | Sim | Web + Pipeline | URL da instancia Supabase |
| `SUPABASE_ANON_KEY` | Sim | Web | Chave anonima (client publico) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Web + Pipeline | Chave service role (bypassa RLS) |
| `RESEND_API_KEY` | Sim | Web | Chave da API Resend |
| `NEWSLETTER_API_SECRET` | Sim | Web + Pipeline | Token Bearer para `/api/send-newsletter` |
| `OPENAI_API_KEY` | Sim | Pipeline | Chave da API OpenAI |
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

- **Quando**: Toda segunda-feira as 11:00 UTC (08:00 BRT)
- **Trigger manual**: Tambem pode ser disparado via `workflow_dispatch`

Configure as secrets no repositorio GitHub:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `NEWSLETTER_API_SECRET`
- `SITE_URL`

---

## Seguranca

### Autenticacao da API

O endpoint `POST /api/send-newsletter` requer um header `Authorization: Bearer {NEWSLETTER_API_SECRET}`. Apenas o pipeline Python e chamadas autorizadas podem disparar o envio.

### Row Level Security (RLS)

Todas as tabelas tem RLS habilitado no Supabase:

- **editions/articles**: Leitura publica (site), escrita apenas via service role (pipeline)
- **subscribers**: Insercao anonima (formulario), leitura/atualizacao via service role. Anon **nao pode** SELECT, prevenindo exfiltracao de emails

### Protecao contra enumeracao

O endpoint `POST /api/subscribe` retorna a mesma resposta independente de o email ja existir ou nao, impedindo que atacantes descubram quais emails estao cadastrados.

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

---

## Licenca

MIT
