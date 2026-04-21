import type { APIRoute } from 'astro'
import { clearAdminSession } from '@/lib/admin-auth'

function redirect(location: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: location },
  })
}

export const POST: APIRoute = async ({ cookies }) => {
  clearAdminSession(cookies)
  return redirect('/admin/announcements?status=logout')
}
