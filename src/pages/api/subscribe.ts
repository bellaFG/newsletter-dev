import type { APIRoute } from 'astro'
import { promises as dns } from 'node:dns'
import { createServerClient } from '@/lib/supabase'

/**
 * POST /api/subscribe
 *
 * Registra um novo subscriber ou reativa um que cancelou a inscricao.
 * Retorna 409 se o email ja estiver inscrito.
 */
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null)
  const email = body?.email?.toString().trim().toLowerCase()

  // Formato, tamanho e dominio com TLD real (min 2 letras)
  if (
    !email ||
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/.test(email)
  ) {
    return new Response(JSON.stringify({ error: 'Email inv\u00e1lido' }), { status: 400 })
  }

  // Verifica se o dominio aceita emails (tem registros MX ou A)
  const domain = email.split('@')[1]
  try {
    await dns.resolveMx(domain)
  } catch {
    try {
      await dns.resolve4(domain)
    } catch {
      return new Response(JSON.stringify({ error: 'Domínio de email não existe.' }), { status: 400 })
    }
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
        console.error('[subscribe] Erro ao reativar subscriber:', error)
        return new Response(JSON.stringify({ error: 'Erro ao cadastrar. Tente novamente.' }), {
          status: 500,
        })
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }
    // Ja ativo — avisa o usuario
    return new Response(JSON.stringify({ error: 'Este email já está inscrito.' }), { status: 409 })
  }

  // Novo subscriber
  const { error } = await supabase.from('subscribers').insert({ email, active: true })

  if (error) {
    console.error('[subscribe] Erro ao inserir subscriber:', error)
    return new Response(JSON.stringify({ error: 'Erro ao cadastrar. Tente novamente.' }), {
      status: 500,
    })
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
