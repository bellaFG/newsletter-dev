-- Migration: adiciona coluna content_ptbr na tabela articles
-- Conteudo editorial enriquecido (2-4 paragrafos) para pagina individual do artigo
-- Distinto de summary_ptbr (2 frases, usado em newsletter/email/cards)

ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_ptbr TEXT;
