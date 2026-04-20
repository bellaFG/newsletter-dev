import type { APIRoute } from 'astro'
import { timingSafeEqual } from 'node:crypto'
import { sendEmail } from '@/lib/brevo'
import { render } from '@react-email/render'
import { createServerClient } from '@/lib/supabase'
import { NewsletterEmail } from '../../../emails/NewsletterEmail'
import type { Article, Edition, NewsletterDelivery } from '@/lib/types'
import { EMAIL_BATCH_SIZE, EMAIL_FROM, DEFAULT_SITE_URL } from '@/lib/config'
import { requireEnv } from '@/lib/env'

const jsonHeaders = { 'Content-Type': 'application/json' }

/** Comparacao de strings em tempo constante (previne timing attacks) */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

/**
 * POST /api/send-newsletter
 *
 * Envia a newsletter para todos os subscribers ativos via Brevo.
 *
 * Autenticacao: Bearer token via header Authorization (NEWSLETTER_API_SECRET).
 * Idempotencia: se a edicao ja foi enviada (sent_at != null), retorna 200 sem reenviar.
 */
export const POST: APIRoute = async ({ request }) => {
  // ── Autenticacao via Bearer token ──
  const authHeader = request.headers.get('authorization') ?? ''
  const expectedSecret = `Bearer ${requireEnv('NEWSLETTER_API_SECRET')}`

  if (!safeCompare(authHeader, expectedSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    })
  }

  const body = await request.json().catch(() => null)
  const edition_id = body?.edition_id

  if (!edition_id) {
    return new Response(JSON.stringify({ error: 'edition_id is required' }), {
      status: 400,
      headers: jsonHeaders,
    })
  }

  const supabase = createServerClient()

  // ── Busca a edicao ──
  const { data: edition, error: editionError } = await supabase
    .from('editions')
    .select('*')
    .eq('id', edition_id)
    .single()

  if (editionError || !edition) {
    return new Response(JSON.stringify({ error: 'Edition not found' }), {
      status: 404,
      headers: jsonHeaders,
    })
  }

  // ── Idempotencia: evita envio duplicado ──
  if (edition.sent_at) {
    return new Response(
      JSON.stringify({ message: 'Newsletter already sent', sent_at: edition.sent_at }),
      { status: 200, headers: jsonHeaders }
    )
  }

  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select('*')
    .eq('edition_id', edition_id)
    .eq('status', 'active')
    .order('position', { ascending: true })

  if (articlesError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch articles' }), {
      status: 500,
      headers: jsonHeaders,
    })
  }

  if (!articles || articles.length === 0) {
    return new Response(JSON.stringify({ error: 'Edition has no active stories' }), {
      status: 400,
      headers: jsonHeaders,
    })
  }

  const { data: subscribers, error: subscribersError } = await supabase
    .from('subscribers')
    .select('email')
    .eq('active', true)

  if (subscribersError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch subscribers' }), {
      status: 500,
      headers: jsonHeaders,
    })
  }

  if (!subscribers || subscribers.length === 0) {
    return new Response(JSON.stringify({ message: 'No active subscribers' }), {
      status: 200,
      headers: jsonHeaders,
    })
  }

  const baseUrl = import.meta.env.SITE_URL ?? DEFAULT_SITE_URL
  const { data: deliveriesData, error: deliveriesError } = await supabase
    .from('newsletter_deliveries')
    .select('email, status, attempts, sent_at')
    .eq('edition_id', edition_id)

  if (deliveriesError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch delivery logs' }), {
      status: 500,
      headers: jsonHeaders,
    })
  }

  const deliveryMap = new Map(
    (
      (deliveriesData ?? []) as Pick<
        NewsletterDelivery,
        'email' | 'status' | 'attempts' | 'sent_at'
      >[]
    ).map((delivery) => [delivery.email, delivery])
  )

  const pendingSubscribers = subscribers.filter(
    (subscriber) => deliveryMap.get(subscriber.email)?.status !== 'sent'
  )
  const alreadySent = subscribers.length - pendingSubscribers.length

  if (pendingSubscribers.length === 0) {
    if (!edition.sent_at) {
      await supabase
        .from('editions')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', edition_id)
    }

    return new Response(
      JSON.stringify({
        message: 'Newsletter already delivered to all active subscribers',
        sent_total: subscribers.length,
      }),
      { status: 200, headers: jsonHeaders }
    )
  }

  // ── Envio individual via Brevo ──
  let totalSentNow = 0
  const errors: string[] = []

  for (const batch of chunkArray(pendingSubscribers, EMAIL_BATCH_SIZE)) {
    for (const subscriber of batch) {
      const previous = deliveryMap.get(subscriber.email)
      const attempt = (previous?.attempts ?? 0) + 1
      const attemptedAt = new Date().toISOString()

      try {
        const html = await render(
          NewsletterEmail({
            edition: edition as Edition,
            articles: (articles ?? []) as Article[],
            unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(subscriber.email)}`,
            siteUrl: baseUrl,
          })
        )

        await sendEmail({
          to: subscriber.email,
          from: EMAIL_FROM,
          subject: edition.title,
          html,
        })

        await supabase.from('newsletter_deliveries').upsert(
          {
            edition_id,
            email: subscriber.email,
            status: 'sent',
            error: null,
            attempts: attempt,
            last_attempt_at: attemptedAt,
            sent_at: attemptedAt,
          },
          { onConflict: 'edition_id,email' }
        )

        deliveryMap.set(subscriber.email, {
          email: subscriber.email,
          status: 'sent',
          attempts: attempt,
          sent_at: attemptedAt,
        })
        totalSentNow++
      } catch (err: any) {
        const message = err?.message ?? 'Unknown error'
        errors.push(`${subscriber.email}: ${message}`)

        await supabase.from('newsletter_deliveries').upsert(
          {
            edition_id,
            email: subscriber.email,
            status: 'failed',
            error: message,
            attempts: attempt,
            last_attempt_at: attemptedAt,
            sent_at: null,
          },
          { onConflict: 'edition_id,email' }
        )

        deliveryMap.set(subscriber.email, {
          email: subscriber.email,
          status: 'failed',
          attempts: attempt,
          sent_at: null,
        })
      }
    }
  }

  const sentTotal = subscribers.filter(
    (subscriber) => deliveryMap.get(subscriber.email)?.status === 'sent'
  ).length

  // So marca como enviado se TODOS tiveram sucesso
  if (sentTotal === subscribers.length) {
    await supabase
      .from('editions')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', edition_id)

    return new Response(
      JSON.stringify({
        success: true,
        sent_now: totalSentNow,
        already_sent: alreadySent,
        sent_total: sentTotal,
      }),
      { headers: jsonHeaders }
    )
  }

  return new Response(
    JSON.stringify({
      error: 'Partial send failure',
      sent_now: totalSentNow,
      already_sent: alreadySent,
      sent_total: sentTotal,
      errors,
    }),
    { status: 207, headers: jsonHeaders }
  )
}
