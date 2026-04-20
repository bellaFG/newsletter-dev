import type { APIRoute } from 'astro'
import { createServerClient } from '@/lib/supabase'
import type { Article, Edition } from '@/lib/types'

const jsonHeaders = { 'Content-Type': 'application/json' }
const MAX_CANDIDATES = 300
const MAX_RESULTS = 20

type SearchArticle = Pick<
  Article,
  | 'id'
  | 'slug'
  | 'title'
  | 'title_ptbr'
  | 'summary_ptbr'
  | 'content_ptbr'
  | 'category'
  | 'source'
  | 'primary_source_label'
  | 'source_count'
  | 'canonical_topic'
> & {
  editions: Pick<Edition, 'slug' | 'edition_number' | 'title' | 'published_at' | 'created_at'>
}

function buildHaystack(article: SearchArticle): string {
  return [
    article.title,
    article.title_ptbr,
    article.summary_ptbr,
    article.content_ptbr,
    article.category,
    article.source,
    article.primary_source_label,
    article.canonical_topic,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

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
    return new Response(JSON.stringify({ results: [] }), { headers: jsonHeaders })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('articles')
    .select(
      'id, slug, title, title_ptbr, summary_ptbr, content_ptbr, category, source, primary_source_label, source_count, canonical_topic, editions!inner(slug, edition_number, title, published_at, created_at)'
    )
    .eq('status', 'active')
    .not('editions.published_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(MAX_CANDIDATES)

  if (error) {
    return new Response(JSON.stringify({ error: 'Search failed' }), {
      status: 500,
      headers: jsonHeaders,
    })
  }

  const terms = query.split(/\s+/).filter(Boolean)
  const results = ((data ?? []) as SearchArticle[])
    .filter((article) => {
      const haystack = buildHaystack(article)
      return haystack.includes(query) || terms.every((term) => haystack.includes(term))
    })
    .slice(0, MAX_RESULTS)
    .map((article) => ({
      id: article.id,
      slug: article.slug,
      title: article.title_ptbr ?? article.title,
      summary: article.summary_ptbr,
      excerpt: buildExcerpt(article),
      category: article.category,
      primarySource: article.primary_source_label ?? article.source,
      sourceCount: article.source_count,
      edition: article.editions,
    }))

  return new Response(JSON.stringify({ results }), { headers: jsonHeaders })
}
