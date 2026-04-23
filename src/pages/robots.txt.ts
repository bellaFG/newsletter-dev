import type { APIRoute } from 'astro'
import { normalizePublicSiteUrl } from '@/lib/config'
import { readEnv } from '@/lib/env'

export const GET: APIRoute = async () => {
  const siteUrl = normalizePublicSiteUrl(readEnv('SITE_URL'))
  const body = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
