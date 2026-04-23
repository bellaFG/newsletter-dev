import type { SupabaseClient } from '@supabase/supabase-js'
import { SEARCH_RESULTS_PER_PAGE, normalizePositiveInteger } from './pagination'
import type { Article, Database, Edition } from './types'

type SearchArticleRow = Article & {
  editions: Pick<Edition, 'slug' | 'edition_number' | 'title' | 'published_at' | 'created_at'>
}

export type SearchResult = {
  id: string
  slug: string
  title: string
  summary: string
  excerpt: string
  category: Article['category']
  primarySource: string
  sourceCount: number
  edition: {
    slug: string
    edition_number: number
    title: string
    published_at: string | null
    created_at: string
  }
}

export type SearchResponse = {
  results: SearchResult[]
  page: number
  hasMore: boolean
  hasPrevious: boolean
}

function buildExcerpt(article: Pick<Article, 'content_ptbr' | 'summary_ptbr'>): string {
  const content = article.content_ptbr?.trim()
  if (content) {
    return content.replace(/\s+/g, ' ').slice(0, 180)
  }

  return article.summary_ptbr.replace(/\s+/g, ' ').slice(0, 180)
}

export async function searchArticles(
  supabase: SupabaseClient<Database>,
  options: { query: string; page?: number; perPage?: number }
): Promise<SearchResponse> {
  const query = options.query.trim()
  const perPage = normalizePositiveInteger(options.perPage, SEARCH_RESULTS_PER_PAGE)
  const page = normalizePositiveInteger(options.page, 1)
  const sanitized = query
    .replace(/[,()\\%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (sanitized.length < 1) {
    return {
      results: [],
      page: 1,
      hasMore: false,
      hasPrevious: false,
    }
  }

  const offset = (page - 1) * perPage
  const pattern = `%${sanitized}%`
  const orFilter = [
    `title.ilike.${pattern}`,
    `title_ptbr.ilike.${pattern}`,
    `summary_ptbr.ilike.${pattern}`,
    `content_ptbr.ilike.${pattern}`,
    `category.ilike.${pattern}`,
    `primary_source_label.ilike.${pattern}`,
  ].join(',')
  const { data, error } = await supabase
    .from('articles')
    .select('*, editions!inner(slug, edition_number, title, published_at, created_at)')
    .eq('status', 'active')
    .not('editions.published_at', 'is', null)
    .or(orFilter)
    .order('source_published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage)

  if (error) {
    throw new Error(`[search] ${error.message}`)
  }

  const rows = (data ?? []) as unknown as SearchArticleRow[]
  const hasMore = rows.length > perPage
  const results = rows.slice(0, perPage).map((article) => ({
    id: article.id,
    slug: article.slug,
    title: article.title_ptbr ?? article.title,
    summary: article.summary_ptbr,
    excerpt: buildExcerpt(article),
    category: article.category,
    primarySource: article.primary_source_label ?? article.source,
    sourceCount: article.source_count,
    edition: {
      slug: article.editions.slug,
      edition_number: article.editions.edition_number,
      title: article.editions.title,
      published_at: article.editions.published_at,
      created_at: article.editions.created_at,
    },
  }))

  return {
    results,
    page,
    hasMore,
    hasPrevious: page > 1,
  }
}
