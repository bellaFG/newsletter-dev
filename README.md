# DevPulse

> Curadoria semanal de tecnologia para devs brasileiros, com IA, leitura de fontes reais e publicação automatizada.

[![Astro](https://img.shields.io/badge/Astro-5.x-ff5d01?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-Pipeline-111111?style=flat-square&logo=openai&logoColor=white)](https://platform.openai.com)
[![Brevo](https://img.shields.io/badge/Brevo-Email-0092ff?style=flat-square)](https://www.brevo.com)

**Site:** [newsletter-dev.vercel.app](https://newsletter-dev.vercel.app)

DevPulse é uma newsletter e um acervo web que coleta sinais de RSS, GitHub Trending e Reddit, filtra ruído com IA, lê as fontes candidatas, monta uma edição editorial em português e publica tudo no site com envio por email.

## O Que Tem Aqui

- Site público em Astro SSR com home, arquivo, páginas de edição, páginas de artigo, categorias, busca, RSS e sitemap.
- Formulário de assinatura com proteção contra enumeração de emails.
- Modal de inscrição, tema claro/escuro persistido e UI responsiva.
- Painel interno em `/admin/announcements` para recados do site.
- Pipeline Python para coleta, curadoria, rascunho, publicação e envio.
- Templates de email com React Email e envio pela API do Brevo.
- Supabase com migrations, RLS, tabelas editoriais, assinantes e auditoria admin.
- GitHub Actions para preparar, validar e publicar a newsletter toda segunda-feira.

## Stack

| Área | Tecnologia |
| --- | --- |
| Web | Astro 5, SSR, Vercel adapter |
| UI | Tailwind CSS, tokens OKLCH, fontes Geist |
| Banco | Supabase, PostgreSQL, RLS |
| Email | React Email, Brevo |
| Curadoria | Python 3.11, OpenAI, Pydantic, BeautifulSoup |
| Automação | GitHub Actions, Supabase CLI |

## Como Funciona

```text
RSS / GitHub / Reddit
        |
        v
Pipeline Python
coleta -> supressões -> triagem IA -> leitura -> pauta -> redação
        |
        v
Supabase
rascunho, edições, artigos, assinantes, recados
        |
        +-------------------+
        |                   |
        v                   v
Site Astro SSR       /api/send-newsletter
arquivo e busca      envio autenticado
                            |
                            v
                          Brevo
```

O fluxo agendado roda em três momentos na segunda-feira:

| Horário BRT | Modo | O que faz |
| --- | --- | --- |
| 07:00 | `prepare` | Coleta fontes, cura a edição e salva rascunho |
| 07:30 | `check-ready` | Confirma que o rascunho está pronto |
| 08:00 | `publish` | Publica a edição e dispara emails |

Também existe `full`, usado manualmente para rodar curadoria e publicação de uma vez.

## Estrutura

```text
.
├── src/
│   ├── components/          # UI compartilhada: nav, cards, masthead, banners
│   ├── layouts/             # Layout global, SEO, tema e modal de inscrição
│   ├── lib/                 # Config, Supabase, Brevo, auth, busca, email
│   ├── pages/               # Rotas Astro, APIs, admin, arquivo e artigos
│   ├── scripts/             # Comportamentos do shell: busca, modal, tema
│   └── styles/              # CSS global, tokens de tema e impressão
├── emails/                  # Template da newsletter em React Email
├── pipeline/                # Coleta, curadoria, publicação e notificações
│   ├── collectors/          # RSS, Reddit e GitHub Trending
│   ├── editorial/           # Persona, metodologia e guia editorial
│   └── sources.yaml         # Fontes monitoradas
├── supabase/
│   ├── migrations/          # Migrations oficiais
│   └── schema.sql           # Snapshot do schema
├── public/                  # Favicon e fontes locais
└── .github/workflows/       # Automação semanal
```

## Primeiros Passos

### Pré-requisitos

- Node.js 22.x
- Python 3.11+
- Supabase CLI, via `npx --yes supabase` ou instalação global
- Conta no Supabase
- Conta no Brevo
- Chave da API OpenAI

### Instalação

```bash
git clone https://github.com/bellaFG/newsletter-dev.git
cd newsletter-dev
npm install
```

Crie o arquivo de ambiente local:

```bash
cp .env.example .env.local
```

Preencha as variáveis descritas em [Variáveis de Ambiente](#variáveis-de-ambiente).

### Banco de Dados

Vincule o projeto Supabase e aplique as migrations:

```bash
npm run supabase:login
npm run supabase:link -- --project-ref <seu-project-ref>
npm run migrate:db
```

Para conferir o histórico local/remoto:

```bash
npm run migrate:list
```

### Desenvolvimento Web

```bash
npm run dev
```

O site fica disponível em `http://localhost:4321`.

### Pipeline Local

```bash
pip install -r pipeline/requirements.txt
python -m pipeline.main prepare --dry-run
```

Modos disponíveis:

```bash
python -m pipeline.main full
python -m pipeline.main prepare
python -m pipeline.main check-ready
python -m pipeline.main publish
```

Use `--dry-run` para validar curadoria e pré-condições sem gravar, publicar ou enviar emails.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o Astro em desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm run preview` | Serve o build localmente |
| `npm run lint` | Executa `astro check` |
| `npm run supabase:login` | Login no Supabase CLI |
| `npm run supabase:link -- --project-ref <ref>` | Vincula o repo ao projeto Supabase |
| `npm run migrate:db` | Aplica migrations com `supabase db push` |
| `npm run migrate:list` | Lista migrations locais/remotas |

## Variáveis de Ambiente

As variáveis ficam em `.env.local` no desenvolvimento e como secrets no Vercel/GitHub Actions em produção.

| Variável | Obrigatória | Usada por | Descrição |
| --- | :---: | --- | --- |
| `SUPABASE_URL` | Sim | Web, pipeline | URL do projeto Supabase |
| `SUPABASE_DB_URL` | Não | Integrações | Endpoint REST opcional para automações externas |
| `SUPABASE_ANON_KEY` | Sim | Web | Chave pública anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Web, pipeline | Chave service role para operações privilegiadas |
| `BREVO_API_KEY` | Sim | Web | Chave da API Brevo |
| `EMAIL_FROM` | Sim | Web | Remetente usado nos disparos |
| `DISCORD_ALERT_WEBHOOK_URL` | Não | Pipeline | Webhook para alertas operacionais |
| `NEWSLETTER_API_SECRET` | Sim | Web, pipeline | Bearer token de `/api/send-newsletter` |
| `ADMIN_API_SECRET` | Não | Web | Secret do painel admin; cai para `NEWSLETTER_API_SECRET` |
| `UNSUBSCRIBE_TOKEN_SECRET` | Não | Web | Secret para tokens de unsubscribe; cai para `NEWSLETTER_API_SECRET` |
| `RATE_LIMIT_SALT` | Não | Web | Sal opcional do rate limit; cai para `NEWSLETTER_API_SECRET` |
| `OPENAI_API_KEY` | Sim | Pipeline | Chave OpenAI |
| `OPENAI_CURATION_TRIAGE_MODEL` | Não | Pipeline | Modelo de triagem; padrão no exemplo: `gpt-5.4-nano` |
| `OPENAI_CURATION_TRIAGE_REASONING` | Não | Pipeline | Esforço da triagem; padrão: `low` |
| `OPENAI_CURATION_EDITOR_MODEL` | Não | Pipeline | Modelo de pauta editorial; padrão no exemplo: `gpt-5.4` |
| `OPENAI_CURATION_EDITOR_REASONING` | Não | Pipeline | Esforço da pauta; padrão: `medium` |
| `OPENAI_CURATION_WRITER_MODEL` | Não | Pipeline | Modelo de redação; padrão: `gpt-5.4-mini` |
| `OPENAI_CURATION_WRITER_REASONING` | Não | Pipeline | Esforço da redação; padrão: `low` |
| `OPENAI_CURATION_SOURCE_TEXT_MAX_CHARS` | Não | Pipeline | Limite de texto por fonte lida |
| `OPENAI_CURATION_MAX_RETRIES` | Não | Pipeline | Tentativas por etapa da curadoria |
| `SITE_URL` | Sim | Web, pipeline | URL pública do site; localmente `http://localhost:4321` |

Secrets extras necessários no GitHub Actions para migrations:

| Secret | Descrição |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Token pessoal do Supabase CLI |
| `SUPABASE_PROJECT_REF` | Project ref do Supabase |

## Pipeline Editorial

O pipeline tenta agir como uma redação pequena:

1. **Coleta:** RSS, GitHub Trending e Reddit geram uma lista grande de candidatos.
2. **Supressões editoriais:** URLs e tópicos bloqueados no banco são removidos.
3. **Triagem:** um modelo barato reduz ruído e agrupa assuntos parecidos.
4. **Leitura:** as fontes aprovadas são abertas e enriquecidas com texto real.
5. **Pauta:** o editor decide o que entra na edição.
6. **Redação:** os artigos finais são escritos em português, com fontes preservadas.
7. **Publicação:** a edição vira rascunho ou é publicada e enviada por email.

Fontes principais configuradas em `pipeline/sources.yaml`:

| Tipo | Fontes |
| --- | --- |
| RSS | Hacker News, The Changelog, InfoQ, dev.to, Lobste.rs, Martin Fowler, ThoughtWorks Radar, The Verge, Ars Technica, GitHub Blog |
| GitHub | Trending geral, Python, TypeScript, Go e Rust |
| Reddit | r/programming, r/webdev, r/MachineLearning, r/devops, r/golang, r/rust |

## Segurança

- CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy` aplicados por middleware.
- Bloqueio de POST cross-origin nas rotas de API.
- RLS habilitado no Supabase.
- Leitura pública só para conteúdo publicado e recados ativos.
- Escrita editorial e leitura de assinantes restritas à service role.
- `POST /api/subscribe` não revela se um email já existe.
- Unsubscribe usa token opaco e confirma cancelamento via `POST /api/unsubscribe`.
- `/api/send-newsletter` exige `Authorization: Bearer NEWSLETTER_API_SECRET`.
- Envio da edição é idempotente para evitar disparos duplicados.
- Painel admin usa cookie HttpOnly com expiração e timeout de inatividade.

## Deploy

### Vercel

Configuração recomendada:

| Campo | Valor |
| --- | --- |
| Framework Preset | Astro |
| Build Command | `npm run build` |
| Output Directory | Deixe vazio |
| Node.js | 22.x |

Configure no Vercel as variáveis usadas pela web: Supabase, Brevo, secrets internos e `SITE_URL`.

### GitHub Actions

O workflow `.github/workflows/newsletter.yml` roda por cron e também por `workflow_dispatch`.

Configure no repositório:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
OPENAI_API_KEY
BREVO_API_KEY
EMAIL_FROM
DISCORD_ALERT_WEBHOOK_URL
NEWSLETTER_API_SECRET
UNSUBSCRIBE_TOKEN_SECRET
SITE_URL
```

## Qualidade

Antes de publicar alterações, rode:

```bash
npm run lint
npm run build
python -m pipeline.main prepare --dry-run
```

O projeto ainda não tem uma suíte dedicada de testes automatizados para todos os fluxos. Hoje, a validação principal é checagem Astro, build, migrations e dry-run do pipeline.

## Licença

MIT
