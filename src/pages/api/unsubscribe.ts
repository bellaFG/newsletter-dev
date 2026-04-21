import type { APIRoute } from 'astro'
import { readUnsubscribeToken } from '@/lib/unsubscribe'
import { createServerClient } from '@/lib/supabase'

function redirect(location: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: location },
  })
}

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData()
  const token = formData.get('token')?.toString().trim() ?? ''
  const email = token ? readUnsubscribeToken(token) : null

  if (!email) {
    return redirect('/unsubscribe?status=invalid')
  }

  const supabase = createServerClient()
  const { error } = await supabase.from('subscribers').update({ active: false }).eq('email', email)

  if (error) {
    console.error('[unsubscribe] Falha ao cancelar inscricao:', error)
    return redirect('/unsubscribe?status=error')
  }

  return redirect('/unsubscribe?status=success')
}
