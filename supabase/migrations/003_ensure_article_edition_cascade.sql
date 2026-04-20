-- Migration: remove artigos orfaos e garante cascade entre editions -> articles

DELETE FROM public.articles AS a
WHERE NOT EXISTS (
  SELECT 1
  FROM public.editions AS e
  WHERE e.id = a.edition_id
);

ALTER TABLE public.articles
DROP CONSTRAINT IF EXISTS articles_edition_id_fkey;

ALTER TABLE public.articles
ADD CONSTRAINT articles_edition_id_fkey
FOREIGN KEY (edition_id)
REFERENCES public.editions(id)
ON DELETE CASCADE;
