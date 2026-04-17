import type { APIRoute } from 'astro'
import { sgMail } from '@/lib/sendgrid'
import { render } from '@react-email/render'
import { createServerClient } from '@/lib/supabase'
import { NewsletterEmail } from '../../../emails/NewsletterEmail'
import type { Article, Edition } from '@/lib/types'
import { EMAIL_FROM, EMAIL_BATCH_SIZE, DEFAULT_SITE_URL } from '@/lib/config'

/**
 * POST /api/send-newsletter
 *
 * Envia a newsletter para todos os subscribers ativos via SendGrid.
 *
 * Autenticacao: Bearer token via header Authorization (NEWSLETTER_API_SECRET).
 * Idempotencia: se a edicao ja foi enviada (sent_at != null), retorna 200 sem reenviar.
 */
export const POST: APIRoute = async ({ request }) => {
  // ── Autenticacao via Bearer token ──
  const authHeader = request.headers.get('authorization')
  const expectedSecret = `Bearer ${import.meta.env.NEWSLETTER_API_SECRET}`

  if (authHeader !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { edition_id } = await request.json()

  if (!edition_id) {
    return new Response(JSON.stringify({ error: 'edition_id is required' }), { status: 400 })
  }

  const supabase = createServerClient()

  // ── Busca a edicao ──
  const { data: edition, error: editionError } = await supabase
    .from('editions')
    .select('*')
    .eq('id', edition_id)
    .single()

  if (editionError || !edition) {
    return new Response(JSON.stringify({ error: 'Edition not found' }), { status: 404 })
  }

  // ── Idempotencia: evita envio duplicado ──
  if (edition.sent_at) {
    return new Response(
      JSON.stringify({ message: 'Newsletter already sent', sent_at: edition.sent_at }),
      { status: 200 },
    )
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

  const baseUrl = import.meta.env.SITE_URL ?? DEFAULT_SITE_URL

  // ── Envio em batches ──
  const allSubscribers = subscribers.map((s) => s.email)
  let totalSent = 0
  const batchErrors: string[] = []

  for (let i = 0; i < allSubscribers.length; i += EMAIL_BATCH_SIZE) {
    const batch = allSubscribers.slice(i, i + EMAIL_BATCH_SIZE)
    const batchIndex = Math.floor(i / EMAIL_BATCH_SIZE) + 1

    try {
      const messages = await Promise.all(
        batch.map(async (email) => {
          const html = await render(
            NewsletterEmail({
              edition: edition as Edition,
              articles: (articles ?? []) as Article[],
              unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`,
            }),
          )
          return {
            to: email,
            from: EMAIL_FROM,
            subject: edition.title,
            html,
          }
        }),
      )

      await sgMail.send(messages)
      totalSent += batch.length
    } catch (err: any) {
      const msg = err?.response?.body?.errors?.[0]?.message ?? err?.message ?? 'Unknown error'
      batchErrors.push(`Batch ${batchIndex}: ${msg}`)
    }
  }

  // So marca como enviado se TODOS os batches tiveram sucesso
  if (batchErrors.length === 0) {
    await supabase
      .from('editions')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', edition_id)

    return new Response(JSON.stringify({ success: true, sent_to: totalSent }))
  }

  return new Response(
    JSON.stringify({
      error: 'Partial send failure',
      sent_to: totalSent,
      batch_errors: batchErrors,
    }),
    { status: 207 },
  )
}
