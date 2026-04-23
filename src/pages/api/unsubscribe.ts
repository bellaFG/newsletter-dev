import type { APIRoute } from 'astro'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServerClient } from '@/lib/supabase'
import { readUnsubscribeTokenDetails } from '@/lib/unsubscribe'

function redirect(location: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: location },
  })
}

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData()
  const token = formData.get('token')?.toString().trim() ?? ''
  const supabase = createServerClient()
  const rateLimit = await checkRateLimit(supabase, request, 'unsubscribe', [
    { limit: 10, windowSec: 60 },
  ])

  if (!rateLimit.allowed) {
    return redirect('/unsubscribe?status=rate_limit')
  }

  const details = token
    ? readUnsubscribeTokenDetails(token)
    : { email: null, expired: false, version: null }
  const email = details.email

  if (!email) {
    return redirect(details.expired ? '/unsubscribe?status=expired' : '/unsubscribe?status=invalid')
  }

  const { error } = await supabase.from('subscribers').update({ active: false }).eq('email', email)

  if (error) {
    console.error('[unsubscribe] Falha ao cancelar inscricao:', error)
    return redirect('/unsubscribe?status=error')
  }

  return redirect('/unsubscribe?status=success')
}
