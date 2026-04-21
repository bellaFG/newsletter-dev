-- DevPulse — Schema completo (referencia)
-- Fonte oficial de deploy: `supabase/migrations/` via `supabase db push`.

-- =============================================
-- TABELAS
-- =============================================

CREATE TABLE editions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL,        -- formato: "YYYY-MM-DD"
  edition_number INTEGER NOT NULL,
  title          TEXT NOT NULL,               -- ex: "DevPulse #001"
  summary        TEXT,
  prepared_at    TIMESTAMPTZ,                 -- rascunho editorial pronto para publicacao
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
  content_ptbr      TEXT,                     -- analise editorial completa em pt-BR
  source            TEXT NOT NULL,            -- ex: "Hacker News", "dev.to"
  category          TEXT NOT NULL,            -- uma das 9 categorias editoriais
  original_language TEXT DEFAULT 'en',
  reading_time_min  INTEGER,
  canonical_topic   TEXT,                     -- chave editorial do tema consolidado
  primary_source_url   TEXT,
  primary_source_label TEXT,
  source_published_at  TIMESTAMPTZ,          -- data da fonte primaria quando conhecida
  source_count      INTEGER DEFAULT 1,
  source_items      JSONB NOT NULL DEFAULT '[]'::jsonb, -- lista de fontes usadas na materia
  status            TEXT NOT NULL DEFAULT 'active',     -- active | removed | suppressed
  position          INTEGER,                  -- ordem de exibicao dentro da edicao
  slug              TEXT NOT NULL,            -- slug gerado a partir do titulo (unico por edicao)
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscribers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  active     BOOLEAN DEFAULT TRUE,           -- false = cancelou inscricao
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE editorial_suppressions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope      TEXT NOT NULL,                  -- url | topic
  value      TEXT NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scope, value)
);

CREATE TABLE newsletter_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id      UUID NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  status          TEXT NOT NULL,             -- sent | failed
  error           TEXT,
  attempts        INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(edition_id, email)
);

CREATE TABLE site_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  dismissible BOOLEAN NOT NULL DEFAULT TRUE,
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDICES
-- =============================================

CREATE INDEX idx_articles_edition_id ON articles(edition_id);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_canonical_topic ON articles(canonical_topic);
CREATE INDEX idx_articles_source_published_at ON articles(source_published_at DESC);
CREATE UNIQUE INDEX idx_articles_slug_edition ON articles(edition_id, slug);
CREATE INDEX idx_editions_slug ON editions(slug);
CREATE INDEX idx_editions_prepared_at ON editions(prepared_at DESC);
CREATE INDEX idx_editions_published_at ON editions(published_at DESC);
CREATE INDEX idx_editions_created_at ON editions(created_at DESC);
CREATE UNIQUE INDEX idx_editorial_suppressions_scope_value ON editorial_suppressions(scope, value);
CREATE UNIQUE INDEX idx_newsletter_deliveries_unique ON newsletter_deliveries(edition_id, email);
CREATE INDEX idx_newsletter_deliveries_status ON newsletter_deliveries(status);
CREATE INDEX idx_newsletter_deliveries_edition_id ON newsletter_deliveries(edition_id);
CREATE INDEX idx_site_announcements_updated_at ON site_announcements(updated_at DESC);
CREATE UNIQUE INDEX idx_site_announcements_single_active
  ON site_announcements ((1))
  WHERE is_active;

-- =============================================
-- FUNCOES
-- =============================================

CREATE OR REPLACE FUNCTION normalize_search_text(input TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT translate(
    lower(coalesce(input, '')),
    'àáâãäåæçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaaceeeeiiiinooooouuuuyyaaaaaaaceeeeiiiinooooouuuuy'
  )
$$;

CREATE OR REPLACE FUNCTION activate_site_announcement(announcement_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM site_announcements
    WHERE id = announcement_id
  ) THEN
    RAISE EXCEPTION 'site_announcement_not_found';
  END IF;

  UPDATE site_announcements
  SET
    is_active = false,
    updated_at = NOW()
  WHERE is_active = true
    AND id <> announcement_id;

  UPDATE site_announcements
  SET
    is_active = true,
    updated_at = NOW()
  WHERE id = announcement_id;
END;
$$;

CREATE OR REPLACE FUNCTION save_site_announcement_and_activate(
  announcement_id UUID,
  announcement_title TEXT,
  announcement_message TEXT,
  announcement_dismissible BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id UUID;
BEGIN
  IF announcement_id IS NULL THEN
    INSERT INTO site_announcements (
      title,
      message,
      dismissible,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      trim(announcement_title),
      trim(announcement_message),
      announcement_dismissible,
      false,
      NOW(),
      NOW()
    )
    RETURNING id INTO target_id;
  ELSE
    UPDATE site_announcements
    SET
      title = trim(announcement_title),
      message = trim(announcement_message),
      dismissible = announcement_dismissible,
      updated_at = NOW()
    WHERE id = announcement_id
    RETURNING id INTO target_id;

    IF target_id IS NULL THEN
      RAISE EXCEPTION 'site_announcement_not_found';
    END IF;
  END IF;

  PERFORM activate_site_announcement(target_id);
END;
$$;

CREATE OR REPLACE FUNCTION deactivate_site_announcement(announcement_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE site_announcements
  SET
    is_active = false,
    updated_at = NOW()
  WHERE id = announcement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'site_announcement_not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION delete_site_announcement(announcement_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM site_announcements
  WHERE id = announcement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'site_announcement_not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION search_articles(
  search_query TEXT,
  result_limit INTEGER DEFAULT 20,
  result_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  title_ptbr TEXT,
  summary_ptbr TEXT,
  content_ptbr TEXT,
  category TEXT,
  source TEXT,
  primary_source_label TEXT,
  source_count INTEGER,
  canonical_topic TEXT,
  source_published_at TIMESTAMPTZ,
  edition_slug TEXT,
  edition_number INTEGER,
  edition_title TEXT,
  edition_published_at TIMESTAMPTZ,
  edition_created_at TIMESTAMPTZ,
  rank REAL
)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  WITH normalized_query AS (
    SELECT websearch_to_tsquery('simple', normalize_search_text(trim(search_query))) AS terms
  )
  SELECT
    a.id,
    a.slug,
    a.title,
    a.title_ptbr,
    a.summary_ptbr,
    a.content_ptbr,
    a.category,
    a.source,
    a.primary_source_label,
    a.source_count,
    a.canonical_topic,
    a.source_published_at,
    e.slug AS edition_slug,
    e.edition_number,
    e.title AS edition_title,
    e.published_at AS edition_published_at,
    e.created_at AS edition_created_at,
    ts_rank(a.search_document, nq.terms)::real AS rank
  FROM articles AS a
  JOIN editions AS e
    ON e.id = a.edition_id
  CROSS JOIN normalized_query AS nq
  WHERE trim(coalesce(search_query, '')) <> ''
    AND a.status = 'active'
    AND e.published_at IS NOT NULL
    AND a.search_document @@ nq.terms
  ORDER BY
    rank DESC,
    coalesce(a.source_published_at, e.published_at, a.created_at) DESC,
    a.created_at DESC
  LIMIT greatest(least(coalesce(result_limit, 20), 50), 1)
  OFFSET greatest(coalesce(result_offset, 0), 0);
$$;

ALTER TABLE articles
  ADD COLUMN search_document TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', normalize_search_text(title_ptbr)), 'A') ||
    setweight(to_tsvector('simple', normalize_search_text(title)), 'A') ||
    setweight(to_tsvector('simple', normalize_search_text(summary_ptbr)), 'B') ||
    setweight(to_tsvector('simple', normalize_search_text(content_ptbr)), 'C') ||
    setweight(to_tsvector('simple', normalize_search_text(category)), 'B') ||
    setweight(to_tsvector('simple', normalize_search_text(source)), 'B') ||
    setweight(to_tsvector('simple', normalize_search_text(primary_source_label)), 'B') ||
    setweight(to_tsvector('simple', normalize_search_text(canonical_topic)), 'A')
  ) STORED;

CREATE INDEX idx_articles_search_document ON articles USING GIN(search_document);

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
ALTER TABLE editorial_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_announcements ENABLE ROW LEVEL SECURITY;

-- editions: leitura publica (paginas do site), escrita apenas via service role (pipeline)
CREATE POLICY "editions_select_public"
  ON editions FOR SELECT
  TO anon, authenticated
  USING (published_at IS NOT NULL);

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
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM editions
      WHERE editions.id = articles.edition_id
        AND editions.published_at IS NOT NULL
    )
  );

CREATE POLICY "articles_insert_service"
  ON articles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "articles_update_service"
  ON articles FOR UPDATE
  TO service_role
  USING (true);

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

CREATE POLICY "editorial_suppressions_select_service"
  ON editorial_suppressions FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "editorial_suppressions_insert_service"
  ON editorial_suppressions FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "editorial_suppressions_update_service"
  ON editorial_suppressions FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "editorial_suppressions_delete_service"
  ON editorial_suppressions FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "newsletter_deliveries_select_service"
  ON newsletter_deliveries FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "newsletter_deliveries_insert_service"
  ON newsletter_deliveries FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "newsletter_deliveries_update_service"
  ON newsletter_deliveries FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "site_announcements_select_public"
  ON site_announcements FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "site_announcements_select_service"
  ON site_announcements FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "site_announcements_insert_service"
  ON site_announcements FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "site_announcements_update_service"
  ON site_announcements FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "site_announcements_delete_service"
  ON site_announcements FOR DELETE
  TO service_role
  USING (true);
