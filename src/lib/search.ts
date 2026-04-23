import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

export const SEARCH_RESULTS_PER_PAGE = 20

type SearchArticle = Database['public']['Functions']['search_articles']['Returns'][number]

export type SearchResult = {
  id: string
  slug: string
  title: string
  summary: string
  excerpt: string
  category: SearchArticle['category']
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

function normalizePage(value: number | null | undefined): number {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : 1
}

function buildExcerpt(article: SearchArticle): string {
  const content = article.content_ptbr?.trim()
  if (content) {
    return content.replace(/\s+/g, ' ').slice(0, 180)
  }

  return article.summary_ptbr.replace(/\s+/g, ' ').slice(0, 180)
}

export async function searchArticles(
  supabase: SupabaseClient<Database>,
  options: { query: string; page?: number; perPage?: number },
): Promise<SearchResponse> {
  const query = options.query.trim().toLowerCase()
  const perPage = normalizePage(options.perPage ?? SEARCH_RESULTS_PER_PAGE)
  const page = normalizePage(options.page)

  if (query.length < 2) {
    return {
      results: [],
      page: 1,
      hasMore: false,
      hasPrevious: false,
    }
  }

  const offset = (page - 1) * perPage
  const { data, error } = await supabase.rpc('search_articles', {
    search_query: query,
    result_limit: perPage + 1,
    result_offset: offset,
  })

  if (error) {
    throw new Error(`[search] ${error.message}`)
  }

  const rows = (data ?? []) as SearchArticle[]
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
      slug: article.edition_slug,
      edition_number: article.edition_number,
      title: article.edition_title,
      published_at: article.edition_published_at,
      created_at: article.edition_created_at,
    },
  }))

  return {
    results,
    page,
    hasMore,
    hasPrevious: page > 1,
  }
}
