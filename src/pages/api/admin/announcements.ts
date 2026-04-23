import type { APIRoute } from 'astro'
import { recordAdminAudit } from '@/lib/admin-audit'
import { hasAdminSession } from '@/lib/admin-auth'
import { getRequestIpHash } from '@/lib/rate-limit'
import { createServerClient } from '@/lib/supabase'

function redirect(location: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: location },
  })
}

function fail(code: string, editId?: string | null) {
  const editQuery = editId ? `&edit=${encodeURIComponent(editId)}` : ''
  return redirect(`/admin/announcements?error=${encodeURIComponent(code)}${editQuery}`)
}

function mapOperationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('site_announcement_not_found')) {
    return 'missing_id'
  }
  return 'save_failed'
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!hasAdminSession(cookies)) {
    return redirect('/admin/announcements?error=auth')
  }

  const actor = getRequestIpHash(request)
  const formData = await request.formData()
  const action = formData.get('action')?.toString() ?? ''
  const id = formData.get('id')?.toString().trim() || null
  const supabase = createServerClient()

  try {
    if (action === 'save') {
      const title = formData.get('title')?.toString().trim() ?? ''
      const message = formData.get('message')?.toString().trim() ?? ''
      const dismissible = formData.get('dismissible') === 'on'

      if (!title || !message) {
        return fail('missing_fields', id)
      }

      if (title.length > 180 || message.length > 4000) {
        return fail('too_long', id)
      }

      const { error } = await supabase.rpc('save_site_announcement_and_activate', {
        announcement_id: id,
        announcement_title: title,
        announcement_message: message,
        announcement_dismissible: dismissible,
      })

      if (error) {
        throw error
      }

      await recordAdminAudit(supabase, {
        actor,
        action: id ? 'announcement_updated' : 'announcement_created',
        targetId: id,
        payload: {
          dismissible,
          messageLength: message.length,
          title,
        },
      })
      return redirect('/admin/announcements?status=saved')
    }

    if (!id) {
      return fail('missing_id')
    }

    if (action === 'activate') {
      const { error } = await supabase.rpc('activate_site_announcement', {
        announcement_id: id,
      })

      if (error) {
        throw error
      }

      await recordAdminAudit(supabase, {
        actor,
        action: 'announcement_activated',
        targetId: id,
      })
      return redirect('/admin/announcements?status=activated')
    }

    if (action === 'deactivate') {
      const { error } = await supabase.rpc('deactivate_site_announcement', {
        announcement_id: id,
      })

      if (error) {
        throw error
      }

      await recordAdminAudit(supabase, {
        actor,
        action: 'announcement_deactivated',
        targetId: id,
      })
      return redirect('/admin/announcements?status=deactivated')
    }

    if (action === 'delete') {
      const { error } = await supabase.rpc('delete_site_announcement', {
        announcement_id: id,
      })

      if (error) {
        throw error
      }

      await recordAdminAudit(supabase, {
        actor,
        action: 'announcement_deleted',
        targetId: id,
      })
      return redirect('/admin/announcements?status=deleted')
    }
  } catch (error) {
    console.error('[admin-announcements] Operacao falhou:', error)
    return fail(mapOperationError(error), id)
  }

  return fail('invalid_action', id)
}
