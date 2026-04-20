-- DevPulse — Schema completo
-- Rode no SQL Editor do Supabase (app.supabase.com -> SQL Editor)

-- =============================================
-- TABELAS
-- =============================================

CREATE TABLE editions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL,        -- formato: "YYYY-MM-DD"
  edition_number INTEGER NOT NULL,
  title          TEXT NOT NULL,               -- ex: "DevPulse #001"
  summary        TEXT,
  published_at   TIMESTAMPTZ,                 -- quando a edicao passa a ser publica no site
  sent_at        TIMESTAMPTZ,                 -- preenchido apos envio dos emails
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE articles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id        UUID REFERENCES editions(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  title_ptbr        TEXT,                     -- titulo traduzido em pt-BR (contextual, nao literal)
  url               TEXT NOT NULL,
  summary_ptbr      TEXT NOT NULL,            -- resumo traduzido/curado em pt-BR
  source            TEXT NOT NULL,            -- ex: "Hacker News", "dev.to"
  category          TEXT NOT NULL,            -- uma das 9 categorias editoriais
  original_language TEXT DEFAULT 'en',
  reading_time_min  INTEGER,
  position          INTEGER,                  -- ordem de exibicao dentro da edicao
  slug              TEXT NOT NULL,             -- slug gerado a partir do titulo (unico por edicao)
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscribers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  active     BOOLEAN DEFAULT TRUE,           -- false = cancelou inscricao
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDICES
-- =============================================

CREATE INDEX idx_articles_edition_id ON articles(edition_id);
CREATE INDEX idx_articles_category ON articles(category);
CREATE UNIQUE INDEX idx_articles_slug_edition ON articles(edition_id, slug);
CREATE INDEX idx_editions_slug ON editions(slug);
CREATE INDEX idx_editions_published_at ON editions(published_at DESC);
CREATE INDEX idx_editions_created_at ON editions(created_at DESC);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
--
-- Estrategia:
-- - editions/articles: leitura publica (site), escrita via service role (pipeline)
-- - subscribers: insercao anonima (formulario), leitura/atualizacao via service role
--
-- O anon NAO pode SELECT em subscribers, prevenindo exfiltracao de emails.
-- A insercao anonima permite o formulario de inscricao funcionar sem autenticacao.
-- =============================================

ALTER TABLE editions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- editions: leitura publica (paginas do site), escrita apenas via service role (pipeline)
CREATE POLICY "editions_select_public"
  ON editions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "editions_insert_service"
  ON editions FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "editions_update_service"
  ON editions FOR UPDATE
  TO service_role
  USING (true);

-- articles: leitura publica (paginas do site), escrita apenas via service role (pipeline)
CREATE POLICY "articles_select_public"
  ON articles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "articles_insert_service"
  ON articles FOR INSERT
  TO service_role
  WITH CHECK (true);

-- subscribers: anon pode INSERIR (formulario publico de inscricao)
-- Nao pode SELECT — impede enumeracao de emails por clientes anonimos
CREATE POLICY "subscribers_insert_anon"
  ON subscribers FOR INSERT
  TO anon
  WITH CHECK (true);

-- subscribers: service role pode ler (envio de newsletter) e atualizar (unsubscribe)
CREATE POLICY "subscribers_select_service"
  ON subscribers FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "subscribers_update_service"
  ON subscribers FOR UPDATE
  TO service_role
  USING (true);
