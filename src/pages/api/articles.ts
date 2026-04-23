import type { APIRoute } from 'astro'
import { listPublishedArticles, paginateItems, serializeArticleCard } from '@/lib/articles'
import { jsonHeaders } from '@/lib/http'
import {
  ARTICLE_LIST_PER_PAGE,
  normalizeArticleListPerPage,
  normalizePositiveInteger,
} from '@/lib/pagination'
import { supabase } from '@/lib/supabase'

export const GET: APIRoute = async ({ url }) => {
  const requestedPage = Number(url.searchParams.get('page') ?? '1')
  const requestedPerPage = Number(url.searchParams.get('perPage') ?? String(ARTICLE_LIST_PER_PAGE))
  const page = normalizePositiveInteger(requestedPage, 1)
  const perPage = normalizeArticleListPerPage(requestedPerPage)

  try {
    const articles = await listPublishedArticles(supabase)
    const { items, page: currentPage, totalPages } = paginateItems(articles, page, perPage)

    return new Response(
      JSON.stringify({
        page: currentPage,
        totalPages,
        hasPrevious: currentPage > 1,
        hasMore: currentPage < totalPages,
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
