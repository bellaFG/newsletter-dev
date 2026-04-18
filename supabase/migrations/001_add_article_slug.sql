-- Migration: adiciona coluna slug na tabela articles
-- Executar no SQL Editor do Supabase (app.supabase.com -> SQL Editor)

-- 1. Adiciona coluna slug (nullable temporariamente)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Popula slugs a partir do titulo (mesma logica do Python publisher)
UPDATE articles
SET slug = LEFT(
  TRIM(BOTH '-' FROM
    regexp_replace(
      lower(
        regexp_replace(
          title,
          '[^a-zA-Z0-9]+', '-', 'g'
        )
      ),
      '-+', '-', 'g'
    )
  ), 80
)
WHERE slug IS NULL;

-- 3. Torna NOT NULL
ALTER TABLE articles ALTER COLUMN slug SET NOT NULL;

-- 4. Cria indice unico (edition_id + slug)
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug_edition ON articles(edition_id, slug);
