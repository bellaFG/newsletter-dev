-- Migration: adiciona prepared_at para separar rascunho pronto da publicacao final

ALTER TABLE public.editions
ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ;

UPDATE public.editions AS e
SET prepared_at = COALESCE(e.published_at, e.sent_at, e.created_at)
WHERE e.prepared_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.articles AS a
    WHERE a.edition_id = e.id
  );

CREATE INDEX IF NOT EXISTS idx_editions_prepared_at
ON public.editions(prepared_at DESC);
