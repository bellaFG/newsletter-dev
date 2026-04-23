import type { APIRoute } from 'astro'
import { clearAdminSession } from '@/lib/admin-auth'
import { redirect } from '@/lib/http'

export const POST: APIRoute = async ({ cookies }) => {
  clearAdminSession(cookies)
  return redirect('/admin/announcements?status=logout')
}
