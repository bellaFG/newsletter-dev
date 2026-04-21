import type { APIRoute } from 'astro'
import { createServerClient } from '@/lib/supabase'
import type { Database } from '@/lib/types'

const jsonHeaders = { 'Content-Type': 'application/json' }
const MAX_RESULTS = 20

type SearchArticle = Database['public']['Functions']['search_articles']['Returns'][number]

function buildExcerpt(article: SearchArticle): string {
  const content = article.content_ptbr?.trim()
  if (content) {
    return content.replace(/\s+/g, ' ').slice(0, 180)
  }
  return article.summary_ptbr.replace(/\s+/g, ' ').slice(0, 180)
}

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  if (query.length < 2) {
    return new Response(
      JSON.stringify({ results: [], page: 1, hasMore: false, hasPrevious: false }),
      { headers: jsonHeaders }
    )
  }

  const requestedPage = Number(url.searchParams.get('page') ?? '1')
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1
  const offset = (page - 1) * MAX_RESULTS

  const supabase = createServerClient()
  const { data, error } = await supabase.rpc('search_articles', {
    search_query: query,
    result_limit: MAX_RESULTS + 1,
    result_offset: offset,
  })

  if (error) {
    return new Response(JSON.stringify({ error: 'Search failed' }), {
      status: 500,
      headers: jsonHeaders,
    })
  }

  const rows = (data ?? []) as SearchArticle[]
  const hasMore = rows.length > MAX_RESULTS
  const results = rows.slice(0, MAX_RESULTS).map((article) => ({
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

  return new Response(
    JSON.stringify({
      results,
      page,
      hasMore,
      hasPrevious: page > 1,
    }),
    { headers: jsonHeaders }
  )
}
