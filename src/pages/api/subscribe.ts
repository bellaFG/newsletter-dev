import type { APIRoute } from 'astro'
import { createServerClient } from '@/lib/supabase'

/**
 * POST /api/subscribe
 *
 * Registra um novo subscriber ou reativa um que cancelou a inscricao.
 * Retorna sempre { success: true } para nao revelar se o email ja existia
 * (protecao contra enumeracao de emails).
 */
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null)
  const email = body?.email?.toString().trim().toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Email inv\u00e1lido' }), { status: 400 })
  }

  const supabase = createServerClient()

  // Verifica se o email ja existe (ativo ou inativo)
  const { data: existing } = await supabase
    .from('subscribers')
    .select('id, active')
    .eq('email', email)
    .single()

  if (existing) {
    // Reativa subscriber que cancelou a inscricao
    if (!existing.active) {
      const { error } = await supabase
        .from('subscribers')
        .update({ active: true })
        .eq('id', existing.id)

      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao cadastrar. Tente novamente.' }), {
          status: 500,
        })
      }
    }
    // Se ja ativo, retorna sucesso sem revelar que ja existia
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }

  // Novo subscriber
  const { error } = await supabase.from('subscribers').insert({ email, active: true })

  if (error) {
    return new Response(JSON.stringify({ error: 'Erro ao cadastrar. Tente novamente.' }), {
      status: 500,
    })
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
