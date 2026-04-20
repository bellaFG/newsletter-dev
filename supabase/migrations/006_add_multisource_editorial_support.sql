-- Migration: suporta matérias editoriais multi-fonte, supressões e rastreamento de entrega

ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS content_ptbr TEXT,
ADD COLUMN IF NOT EXISTS canonical_topic TEXT,
ADD COLUMN IF NOT EXISTS primary_source_url TEXT,
ADD COLUMN IF NOT EXISTS primary_source_label TEXT,
ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS source_items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

UPDATE public.articles
SET
  primary_source_url = COALESCE(primary_source_url, url),
  primary_source_label = COALESCE(primary_source_label, source),
  source_count = COALESCE(source_count, 1),
  source_items = CASE
    WHEN source_items IS NULL OR source_items = '[]'::jsonb THEN
      jsonb_build_array(
        jsonb_build_object(
          'label', COALESCE(source, ''),
          'url', COALESCE(url, ''),
          'title', COALESCE(title, ''),
          'snippet', summary_ptbr,
          'is_primary', true
        )
      )
    ELSE source_items
  END,
  status = COALESCE(status, 'active');

ALTER TABLE public.articles
ALTER COLUMN source_items SET NOT NULL,
ALTER COLUMN source_items SET DEFAULT '[]'::jsonb,
ALTER COLUMN status SET NOT NULL,
ALTER COLUMN status SET DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_articles_status
ON public.articles(status);

CREATE INDEX IF NOT EXISTS idx_articles_canonical_topic
ON public.articles(canonical_topic);

CREATE TABLE IF NOT EXISTS public.editorial_suppressions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope      TEXT NOT NULL,
  value      TEXT NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scope, value)
);

CREATE TABLE IF NOT EXISTS public.newsletter_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id      UUID NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  status          TEXT NOT NULL,
  error           TEXT,
  attempts        INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(edition_id, email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_editorial_suppressions_scope_value
ON public.editorial_suppressions(scope, value);

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_deliveries_unique
ON public.newsletter_deliveries(edition_id, email);

CREATE INDEX IF NOT EXISTS idx_newsletter_deliveries_status
ON public.newsletter_deliveries(status);

CREATE INDEX IF NOT EXISTS idx_newsletter_deliveries_edition_id
ON public.newsletter_deliveries(edition_id);

ALTER TABLE public.editorial_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editions_select_public" ON public.editions;
CREATE POLICY "editions_select_public"
  ON public.editions FOR SELECT
  TO anon, authenticated
  USING (published_at IS NOT NULL);

DROP POLICY IF EXISTS "articles_select_public" ON public.articles;
CREATE POLICY "articles_select_public"
  ON public.articles FOR SELECT
  TO anon, authenticated
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.editions
      WHERE public.editions.id = public.articles.edition_id
        AND public.editions.published_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "articles_update_service" ON public.articles;
CREATE POLICY "articles_update_service"
  ON public.articles FOR UPDATE
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "editorial_suppressions_select_service" ON public.editorial_suppressions;
CREATE POLICY "editorial_suppressions_select_service"
  ON public.editorial_suppressions FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "editorial_suppressions_insert_service" ON public.editorial_suppressions;
CREATE POLICY "editorial_suppressions_insert_service"
  ON public.editorial_suppressions FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "editorial_suppressions_update_service" ON public.editorial_suppressions;
CREATE POLICY "editorial_suppressions_update_service"
  ON public.editorial_suppressions FOR UPDATE
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "editorial_suppressions_delete_service" ON public.editorial_suppressions;
CREATE POLICY "editorial_suppressions_delete_service"
  ON public.editorial_suppressions FOR DELETE
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "newsletter_deliveries_select_service" ON public.newsletter_deliveries;
CREATE POLICY "newsletter_deliveries_select_service"
  ON public.newsletter_deliveries FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "newsletter_deliveries_insert_service" ON public.newsletter_deliveries;
CREATE POLICY "newsletter_deliveries_insert_service"
  ON public.newsletter_deliveries FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "newsletter_deliveries_update_service" ON public.newsletter_deliveries;
CREATE POLICY "newsletter_deliveries_update_service"
  ON public.newsletter_deliveries FOR UPDATE
  TO service_role
  USING (true);
