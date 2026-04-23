import type { APIRoute } from 'astro'
import { recordAdminAudit } from '@/lib/admin-audit'
import { isValidAdminSecret, setAdminSession } from '@/lib/admin-auth'
import { redirect } from '@/lib/http'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServerClient } from '@/lib/supabase'

function normalizeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/')) return '/admin/announcements'
  return value
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const formData = await request.formData()
  const secret = formData.get('secret')?.toString().trim() ?? ''
  const redirectTo = normalizeRedirect(formData.get('redirect_to')?.toString() ?? null)
  const supabase = createServerClient()
  const rateLimit = await checkRateLimit(supabase, request, 'admin_login', [
    { limit: 5, windowSec: 60 },
    { limit: 20, windowSec: 60 * 60 },
  ])

  if (!rateLimit.allowed) {
    await recordAdminAudit(supabase, {
      actor: rateLimit.ipHash,
      action: 'admin_login_rate_limited',
      payload: { redirectTo },
    })
    return redirect(`${redirectTo}?error=rate_limit`)
  }

  if (!secret || !isValidAdminSecret(secret)) {
    await recordAdminAudit(supabase, {
      actor: rateLimit.ipHash,
      action: 'admin_login_failed',
      payload: { redirectTo },
    })
    return redirect(`${redirectTo}?error=login`)
  }

  setAdminSession(cookies)
  await recordAdminAudit(supabase, {
    actor: rateLimit.ipHash,
    action: 'admin_login_succeeded',
    payload: { redirectTo },
  })
  return redirect(`${redirectTo}?status=login`)
}
