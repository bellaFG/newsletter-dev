import type { SupabaseClient } from '@supabase/supabase-js'
import type { SiteAnnouncement } from './announcements'
import type { Database, SiteAnnouncementRow } from './types'

type DatabaseClient = SupabaseClient<Database>

export function mapAnnouncementRowToSiteAnnouncement(row: SiteAnnouncementRow): SiteAnnouncement {
  return {
    id: row.id,
    scope: 'global',
    tone: 'info',
    eyebrow: 'Comunicado',
    title: row.title,
    message: row.message,
    dismissible: row.dismissible,
    revision: row.updated_at,
  }
}

export async function getActiveSiteAnnouncement(
  supabase: DatabaseClient,
): Promise<SiteAnnouncement | null> {
  const { data, error } = await supabase
    .from('site_announcements')
    .select('*')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[announcements] Falha ao buscar anuncio ativo:', error)
    return null
  }

  return data ? mapAnnouncementRowToSiteAnnouncement(data) : null
}

export async function listSiteAnnouncementsForAdmin(
  supabase: DatabaseClient,
  limit = 20,
): Promise<SiteAnnouncementRow[]> {
  const { data, error } = await supabase
    .from('site_announcements')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[announcements] Falha ao listar anuncios do admin:', error)
    return []
  }

  return (data ?? []) as SiteAnnouncementRow[]
}
