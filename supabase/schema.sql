-- DevPulse — Schema completo
-- Rode no SQL Editor do Supabase (app.supabase.com → SQL Editor)

-- =============================================
-- TABELAS
-- =============================================

CREATE TABLE editions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL,
  edition_number INTEGER NOT NULL,
  title          TEXT NOT NULL,
  summary        TEXT,
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE articles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id        UUID REFERENCES editions(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  url               TEXT NOT NULL,
  summary_ptbr      TEXT NOT NULL,
  source            TEXT NOT NULL,
  category          TEXT NOT NULL,
  original_language TEXT DEFAULT 'en',
  reading_time_min  INTEGER,
  position          INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscribers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES
-- =============================================

CREATE INDEX idx_articles_edition_id ON articles(edition_id);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_editions_slug ON editions(slug);
CREATE INDEX idx_editions_created_at ON editions(created_at DESC);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE editions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- editions: leitura pública, escrita apenas via service role
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

-- articles: leitura pública, escrita apenas via service role
CREATE POLICY "articles_select_public"
  ON articles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "articles_insert_service"
  ON articles FOR INSERT
  TO service_role
  WITH CHECK (true);

-- subscribers: anon pode inserir (formulário de inscrição), service role lê tudo
CREATE POLICY "subscribers_insert_anon"
  ON subscribers FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "subscribers_select_service"
  ON subscribers FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "subscribers_update_service"
  ON subscribers FOR UPDATE
  TO service_role
  USING (true);
