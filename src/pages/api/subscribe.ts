import type { APIRoute } from 'astro'
import { createServiceClient } from '@/lib/supabase'

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null)
  const email = body?.email?.toString().trim().toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Email inválido' }), { status: 400 })
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('subscribers')
    .insert({ email, active: true })

  if (error) {
    if (error.code === '23505') {
      return new Response(JSON.stringify({ error: 'Email já cadastrado' }), { status: 409 })
    }
    return new Response(JSON.stringify({ error: 'Erro ao cadastrar. Tente novamente.' }), {
      status: 500,
    })
  }

  return new Response(JSON.stringify({ success: true }), { status: 201 })
}
