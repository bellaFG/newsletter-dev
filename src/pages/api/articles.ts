import type { APIRoute } from 'astro'
import { listPublishedArticles, paginateItems, serializeArticleCard } from '@/lib/articles'
import { supabase } from '@/lib/supabase'

const jsonHeaders = { 'Content-Type': 'application/json' }
const DEFAULT_PER_PAGE = 9
const MAX_PER_PAGE = 24

export const GET: APIRoute = async ({ url }) => {
  const requestedPage = Number(url.searchParams.get('page') ?? '1')
  const requestedPerPage = Number(url.searchParams.get('perPage') ?? String(DEFAULT_PER_PAGE))
  const perPage =
    Number.isFinite(requestedPerPage) && requestedPerPage > 0
      ? Math.min(Math.floor(requestedPerPage), MAX_PER_PAGE)
      : DEFAULT_PER_PAGE

  try {
    const articles = await listPublishedArticles(supabase)
    const { items, page, totalPages } = paginateItems(articles, requestedPage, perPage)

    return new Response(
      JSON.stringify({
        page,
        totalPages,
        hasPrevious: page > 1,
        hasMore: page < totalPages,
        items: items.map(serializeArticleCard),
      }),
      { headers: jsonHeaders }
    )
  } catch {
    return new Response(JSON.stringify({ error: 'Articles failed' }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
}
