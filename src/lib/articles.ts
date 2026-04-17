/**
 * Logica compartilhada de categorias e agrupamento de artigos.
 * Usado pelas paginas de edicao ([slug].astro) e pelo template de email (NewsletterEmail.tsx).
 */

import type { Article, ArticleCategory } from './types'

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
export function groupByCategory(
  articles: Article[],
): Partial<Record<ArticleCategory, Article[]>> {
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
  grouped: Partial<Record<ArticleCategory, Article[]>>,
): ArticleCategory[] {
  return CATEGORY_ORDER.filter((c) => grouped[c]?.length)
}
