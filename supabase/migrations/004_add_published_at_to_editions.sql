-- Migration: adiciona published_at para separar publicacao no site do envio de email

ALTER TABLE public.editions
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE public.editions AS e
SET published_at = COALESCE(e.sent_at, e.created_at)
WHERE e.published_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.articles AS a
    WHERE a.edition_id = e.id
  );

CREATE INDEX IF NOT EXISTS idx_editions_published_at
ON public.editions(published_at DESC);
