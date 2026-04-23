import type { APIRoute } from 'astro'
import { CATEGORY_ORDER, CATEGORY_SLUGS } from '@/lib/articles'
import { normalizePublicSiteUrl } from '@/lib/config'
import { readEnv } from '@/lib/env'
import { listEditionsWithArticles } from '@/lib/editions'
import { supabase } from '@/lib/supabase'
import type { Article, Edition } from '@/lib/types'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export const GET: APIRoute = async () => {
  const siteUrl = normalizePublicSiteUrl(readEnv('SITE_URL'))
  const editions = await listEditionsWithArticles(supabase)

  const { data: articleRows } = await supabase
    .from('articles')
    .select('slug, created_at, source_published_at, editions!inner(slug, published_at, created_at)')
    .eq('status', 'active')
    .not('editions.published_at', 'is', null)

  type ArticleRow = Pick<Article, 'slug' | 'created_at' | 'source_published_at'> & {
    editions: Pick<Edition, 'slug' | 'published_at' | 'created_at'>
  }

  const articles = (articleRows ?? []) as unknown as ArticleRow[]

  const routes = [
    { loc: `${siteUrl}/`, lastmod: null },
    { loc: `${siteUrl}/archive`, lastmod: editions[0]?.published_at ?? editions[0]?.created_at ?? null },
    { loc: `${siteUrl}/articles`, lastmod: editions[0]?.published_at ?? editions[0]?.created_at ?? null },
    ...CATEGORY_ORDER.map((category) => ({
      loc: `${siteUrl}/categoria/${CATEGORY_SLUGS[category]}`,
      lastmod: editions[0]?.published_at ?? editions[0]?.created_at ?? null,
    })),
    ...editions.map((edition) => ({
      loc: `${siteUrl}/edicao/${edition.slug}`,
      lastmod: edition.published_at ?? edition.created_at,
    })),
    ...articles.map((article) => ({
      loc: `${siteUrl}/edicao/${article.editions.slug}/${article.slug}`,
      lastmod: article.source_published_at ?? article.editions.published_at ?? article.created_at,
    })),
  ]

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${escapeXml(route.loc)}</loc>${route.lastmod ? `
    <lastmod>${new Date(route.lastmod).toISOString()}</lastmod>` : ''}
  </url>`,
  )
  .join('\n')}
</urlset>`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
