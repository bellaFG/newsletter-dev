import type { APIRoute } from 'astro'
import { resend } from '@/lib/resend'
import { createServiceClient } from '@/lib/supabase'

export const POST: APIRoute = async ({ request }) => {
  // Valida o secret para que só o pipeline Python consiga chamar essa rota
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

  // Busca a edição e seus artigos
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

  // Busca todos os subscribers ativos
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

  // Envia o e-mail — por enquanto HTML simples; na Fase 7 substituímos pelo template React Email
  const emailList = subscribers.map((s) => s.email)

  const { error: sendError } = await resend.emails.send({
    from: 'DevPulse <onboarding@resend.dev>', // trocar pelo domínio verificado em produção
    to: emailList,
    subject: edition.title,
    html: `
      <h1>${edition.title}</h1>
      ${edition.summary ? `<p>${edition.summary}</p>` : ''}
      <hr />
      ${(articles ?? [])
        .map(
          (a) => `
        <div>
          <h2>${a.title}</h2>
          <p><strong>${a.category}</strong> · ${a.source} · ${a.reading_time_min ? `${a.reading_time_min} min` : ''}</p>
          <p>${a.summary_ptbr}</p>
          <a href="${a.url}">Leia completo →</a>
        </div>
        <hr />
      `,
        )
        .join('')}
    `,
  })

  if (sendError) {
    return new Response(JSON.stringify({ error: sendError.message }), { status: 500 })
  }

  // Atualiza sent_at da edição
  await supabase
    .from('editions')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', edition_id)

  return new Response(JSON.stringify({ success: true, sent_to: emailList.length }))
}
