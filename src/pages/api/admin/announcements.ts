import type { APIRoute } from 'astro'
import { hasAdminSession } from '@/lib/admin-auth'
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

async function deactivateOtherAnnouncements(supabase: ReturnType<typeof createServerClient>, currentId?: string) {
  let query = supabase
    .from('site_announcements')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('is_active', true)

  if (currentId) {
    query = query.neq('id', currentId)
  }

  const { error } = await query
  if (error) {
    throw error
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!hasAdminSession(cookies)) {
    return redirect('/admin/announcements?error=auth')
  }

  const formData = await request.formData()
  const action = formData.get('action')?.toString() ?? ''
  const id = formData.get('id')?.toString().trim() || null
  const supabase = createServerClient()
  const now = new Date().toISOString()

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

      await deactivateOtherAnnouncements(supabase, id ?? undefined)

      if (id) {
        const { error } = await supabase
          .from('site_announcements')
          .update({
            title,
            message,
            dismissible,
            is_active: true,
            updated_at: now,
          })
          .eq('id', id)

        if (error) {
          throw error
        }
      } else {
        const { error } = await supabase
          .from('site_announcements')
          .insert({
            title,
            message,
            dismissible,
            is_active: true,
            created_at: now,
            updated_at: now,
          })

        if (error) {
          throw error
        }
      }

      return redirect('/admin/announcements?status=saved')
    }

    if (!id) {
      return fail('missing_id')
    }

    if (action === 'activate') {
      await deactivateOtherAnnouncements(supabase, id)
      const { error } = await supabase
        .from('site_announcements')
        .update({
          is_active: true,
          updated_at: now,
        })
        .eq('id', id)

      if (error) {
        throw error
      }

      return redirect('/admin/announcements?status=activated')
    }

    if (action === 'deactivate') {
      const { error } = await supabase
        .from('site_announcements')
        .update({
          is_active: false,
          updated_at: now,
        })
        .eq('id', id)

      if (error) {
        throw error
      }

      return redirect('/admin/announcements?status=deactivated')
    }

    if (action === 'delete') {
      const { error } = await supabase
        .from('site_announcements')
        .delete()
        .eq('id', id)

      if (error) {
        throw error
      }

      return redirect('/admin/announcements?status=deleted')
    }
  } catch (error) {
    console.error('[admin-announcements] Operacao falhou:', error)
    return fail('save_failed', id)
  }

  return fail('invalid_action', id)
}
