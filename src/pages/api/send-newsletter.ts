import type { APIRoute } from 'astro'
import { resend } from '@/lib/resend'
import { createServiceClient } from '@/lib/supabase'
import { NewsletterEmail } from '../../../emails/NewsletterEmail'
import type { Article, Edition } from '@/lib/types'

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('authorization')
  const expectedSecret = `Bearer ${import.meta.env.NEWSLETTER_API_SECRET}`

  if (authHeader !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { edition_id } = await request.json()

  if (!edition_id) {
    return new Response(JSON.stringify({ error: 'edition_id is required' }), { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: edition, error: editionError } = await supabase
    .from('editions')
    .select('*')
    .eq('id', edition_id)
    .single()

  if (editionError || !edition) {
    return new Response(JSON.stringify({ error: 'Edition not found' }), { status: 404 })
  }

  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select('*')
    .eq('edition_id', edition_id)
    .order('position', { ascending: true })

  if (articlesError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch articles' }), { status: 500 })
  }

  const { data: subscribers, error: subscribersError } = await supabase
    .from('subscribers')
    .select('email')
    .eq('active', true)

  if (subscribersError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch subscribers' }), { status: 500 })
  }

  if (!subscribers || subscribers.length === 0) {
    return new Response(JSON.stringify({ message: 'No active subscribers' }), { status: 200 })
  }

  const baseUrl = import.meta.env.SITE_URL ?? 'https://devpulse.com.br'

  // Envia um email por subscriber para gerar URL de unsubscribe personalizada
  // Resend batch: máximo 100 por chamada
  const BATCH_SIZE = 100
  const allSubscribers = subscribers.map((s) => s.email)
  let totalSent = 0

  for (let i = 0; i < allSubscribers.length; i += BATCH_SIZE) {
    const batch = allSubscribers.slice(i, i + BATCH_SIZE)

    const emails = batch.map((email) => ({
      from: 'DevPulse <newsletter@devpulse.com.br>',
      to: email,
      subject: edition.title,
      react: NewsletterEmail({
        edition: edition as Edition,
        articles: (articles ?? []) as Article[],
        unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`,
      }),
    }))

    const { error: sendError } = await resend.batch.send(emails)

    if (sendError) {
      return new Response(JSON.stringify({ error: sendError.message }), { status: 500 })
    }

    totalSent += batch.length
  }

  await supabase
    .from('editions')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', edition_id)

  return new Response(JSON.stringify({ success: true, sent_to: totalSent }))
}
