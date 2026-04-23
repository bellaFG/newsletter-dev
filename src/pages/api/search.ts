import type { APIRoute } from 'astro'
import { jsonHeaders } from '@/lib/http'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServerClient } from '@/lib/supabase'
import { searchArticles } from '@/lib/search'

export const GET: APIRoute = async ({ request, url }) => {
  const query = url.searchParams.get('q')?.trim() ?? ''
  const requestedPage = Number(url.searchParams.get('page') ?? '1')

  const supabase = createServerClient()
  if (query.length >= 1) {
    const rateLimit = await checkRateLimit(supabase, request, 'search', [
      { limit: 30, windowSec: 60 },
    ])

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Muitas buscas em sequência. Tente novamente em instantes.' }),
        {
          status: 429,
          headers: {
            ...jsonHeaders,
            'Retry-After': String(rateLimit.retryAfter),
          },
        }
      )
    }
  }

  try {
    const data = await searchArticles(supabase, { query, page: requestedPage })

    return new Response(JSON.stringify(data), { headers: jsonHeaders })
  } catch {
    return new Response(JSON.stringify({ error: 'Search failed' }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
}
