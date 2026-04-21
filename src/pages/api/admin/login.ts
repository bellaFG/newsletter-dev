import type { APIRoute } from 'astro'
import { isValidAdminSecret, setAdminSession } from '@/lib/admin-auth'

function redirect(location: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: location },
  })
}

function normalizeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/')) return '/admin/announcements'
  return value
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const formData = await request.formData()
  const secret = formData.get('secret')?.toString().trim() ?? ''
  const redirectTo = normalizeRedirect(formData.get('redirect_to')?.toString() ?? null)

  if (!secret || !isValidAdminSecret(secret)) {
    return redirect(`${redirectTo}?error=login`)
  }

  setAdminSession(cookies)
  return redirect(`${redirectTo}?status=login`)
}
