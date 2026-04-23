import type { APIRoute } from 'astro'
import { normalizePublicSiteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/config'
import { readEnv } from '@/lib/env'
import { listEditionsWithArticles } from '@/lib/editions'
import { supabase } from '@/lib/supabase'

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
  const editions = await listEditionsWithArticles(supabase, { from: 0, to: 19 })
  const latestPubDate = editions[0]?.published_at ?? editions[0]?.created_at ?? new Date().toISOString()

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>pt-BR</language>
    <lastBuildDate>${new Date(latestPubDate).toUTCString()}</lastBuildDate>
${editions
  .map((edition) => {
    const link = `${siteUrl}/edicao/${edition.slug}`
    const description =
      edition.summary?.trim() || `Leia a edição #${edition.edition_number} no acervo do ${SITE_NAME}.`

    return `    <item>
      <title>${escapeXml(edition.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid>${escapeXml(link)}</guid>
      <pubDate>${new Date(edition.published_at ?? edition.created_at).toUTCString()}</pubDate>
      <description>${escapeXml(description)}</description>
    </item>`
  })
  .join('\n')}
  </channel>
</rss>`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
