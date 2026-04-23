import type { APIRoute } from 'astro'
import { promises as dns } from 'node:dns'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServerClient } from '@/lib/supabase'

const jsonHeaders = { 'Content-Type': 'application/json' }

/**
 * POST /api/subscribe
 *
 * Registra um novo subscriber ou reativa um que cancelou a inscricao.
 * Resposta identica para email novo, reativado ou ja ativo (anti-enumeracao).
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null)
    const email = body?.email?.toString().trim().toLowerCase()
    const website = body?.website?.toString().trim() ?? ''
    const supabase = createServerClient()

    if (website) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders })
    }

    const rateLimit = await checkRateLimit(supabase, request, 'subscribe', [
      { limit: 5, windowSec: 60 },
    ])
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: 'Muitas tentativas. Tente novamente em instantes.' }), {
        status: 429,
        headers: {
          ...jsonHeaders,
          'Retry-After': String(rateLimit.retryAfter),
        },
      })
    }

    // Formato, tamanho e dominio com TLD real (min 2 letras)
    if (
      !email ||
      email.length > 254 ||
      !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/.test(email)
    ) {
      return new Response(JSON.stringify({ error: 'Email inválido' }), { status: 400, headers: jsonHeaders })
    }

    // Verifica se o dominio aceita emails (tem registros MX ou A)
    const domain = email.split('@')[1]
    try {
      await dns.resolveMx(domain)
    } catch {
      try {
        await dns.resolve4(domain)
      } catch {
        return new Response(JSON.stringify({ error: 'Domínio de email não existe.' }), { status: 400, headers: jsonHeaders })
      }
    }

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
            status: 500, headers: jsonHeaders,
          })
        }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders })
      }
      // Ja ativo — retorna sucesso (anti-enumeracao: mesma resposta que novo subscriber)
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders })
    }

    // Novo subscriber
    const { error } = await supabase.from('subscribers').insert({ email, active: true })

    if (error) {
      console.error('[subscribe] Erro ao inserir subscriber:', error)
      return new Response(JSON.stringify({ error: 'Erro ao cadastrar. Tente novamente.' }), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders })
  } catch (err) {
    console.error('[subscribe] Erro inesperado:', err)
    return new Response(JSON.stringify({ error: 'Erro ao cadastrar. Tente novamente.' }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
}
