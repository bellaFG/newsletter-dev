/**
 * Logica compartilhada de categorias e agrupamento de artigos.
 * Usado pelas paginas de edicao ([slug].astro) e pelo template de email (NewsletterEmail.tsx).
 */

import type { Article, ArticleCategory, ArticleSource } from './types'

/** Gera um slug URL-safe a partir de texto (mesma logica do Python publisher) */
export function slugify(text: string, maxLength = 80): string {
  let slug = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (slug.length > maxLength) {
    slug = slug.slice(0, maxLength).replace(/-[^-]*$/, '')
  }
  return slug
}

/** Ordem editorial fixa das categorias na newsletter */
export const CATEGORY_ORDER: ArticleCategory[] = [
  'IA & Machine Learning',
  'Backend',
  'Frontend',
  'DevOps & Cloud',
  'Linguagens & Frameworks',
  'Ferramentas & Produtividade',
  'Open Source',
  'Seguran\u00e7a',
  'Carreira & Cultura',
]

/**
 * Agrupa artigos por categoria.
 *
 * @example
 * const grouped = groupByCategory(articles)
 * // { 'Backend': [article1, article2], 'Frontend': [article3] }
 */
export function groupByCategory(articles: Article[]): Partial<Record<ArticleCategory, Article[]>> {
  return articles.reduce<Partial<Record<ArticleCategory, Article[]>>>((acc, a) => {
    if (!acc[a.category]) acc[a.category] = []
    acc[a.category]!.push(a)
    return acc
  }, {})
}

/**
 * Retorna apenas as categorias que possuem artigos, na ordem editorial.
 *
 * @example
 * const categories = getOrderedCategories(grouped)
 * // ['Backend', 'Frontend'] (somente categorias com artigos)
 */
export function getOrderedCategories(
  grouped: Partial<Record<ArticleCategory, Article[]>>
): ArticleCategory[] {
  return CATEGORY_ORDER.filter((c) => grouped[c]?.length)
}

/** Mapa de categoria editorial → slug URL */
export const CATEGORY_SLUGS: Record<ArticleCategory, string> = {
  'IA & Machine Learning': 'ia-machine-learning',
  Backend: 'backend',
  Frontend: 'frontend',
  'DevOps & Cloud': 'devops-cloud',
  'Linguagens & Frameworks': 'linguagens-frameworks',
  'Ferramentas & Produtividade': 'ferramentas-produtividade',
  'Open Source': 'open-source',
  'Seguran\u00e7a': 'seguranca',
  'Carreira & Cultura': 'carreira-cultura',
}

/** Mapa inverso: slug URL → categoria editorial */
export const SLUG_TO_CATEGORY: Record<string, ArticleCategory> = Object.fromEntries(
  Object.entries(CATEGORY_SLUGS).map(([k, v]) => [v, k as ArticleCategory])
) as Record<string, ArticleCategory>

/** Retorna a lista de fontes de uma matéria, com fallback para registros legados. */
export function getArticleSources(
  article: Pick<
    Article,
    | 'source_items'
    | 'source_count'
    | 'source'
    | 'url'
    | 'primary_source_label'
    | 'primary_source_url'
  >
): ArticleSource[] {
  const sources = (article.source_items ?? []).filter((source) => source?.label && source?.url)
  if (sources.length > 0) {
    return [...sources].sort(
      (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
    )
  }

  return [
    {
      label: article.primary_source_label ?? article.source,
      url: article.primary_source_url ?? article.url,
      is_primary: true,
    },
  ]
}

/** Retorna a fonte principal de uma matéria, com fallback para o modelo legado. */
export function getPrimarySource(
  article: Pick<
    Article,
    | 'source_items'
    | 'source_count'
    | 'source'
    | 'url'
    | 'primary_source_label'
    | 'primary_source_url'
  >
): ArticleSource {
  const sources = getArticleSources(article)
  return sources.find((source) => source.is_primary) ?? sources[0]
}
