export type AnnouncementTone = 'info' | 'warning' | 'success'
export type AnnouncementScope = 'global' | 'home'

export type SiteAnnouncement = {
  id: string
  scope: AnnouncementScope
  tone: AnnouncementTone
  eyebrow?: string
  title: string
  message: string
  note?: string
  ctaHref?: string
  ctaLabel?: string
  startsAt?: string
  endsAt?: string
}

/**
 * Comunicados manuais do produto/editorial.
 *
 * Deixe o item ativo enquanto quiser exibir o banner.
 * Para anuncios temporarios, preencha `startsAt`/`endsAt`.
 */
const MANUAL_ANNOUNCEMENTS: SiteAnnouncement[] = [
  {
    id: 'weekly-format',
    scope: 'global',
    tone: 'info',
    eyebrow: 'Recado da redação',
    title: 'DevPulse agora é semanal.',
    message:
      'Toda segunda-feira, às 08:00 BRT, entra uma nova edição com a curadoria da semana. ' +
      'Quando mudarmos formato, frequência ou foco editorial, avisamos por aqui.',
    ctaHref: '/archive',
    ctaLabel: 'Ver edições publicadas →',
  },
]

function isWithinWindow(announcement: SiteAnnouncement, now: Date): boolean {
  if (announcement.startsAt && now.getTime() < new Date(announcement.startsAt).getTime()) {
    return false
  }

  if (announcement.endsAt && now.getTime() > new Date(announcement.endsAt).getTime()) {
    return false
  }

  return true
}

export function getActiveAnnouncements(
  scope: AnnouncementScope,
  now = new Date(),
): SiteAnnouncement[] {
  return MANUAL_ANNOUNCEMENTS.filter((announcement) => {
    return announcement.scope === scope && isWithinWindow(announcement, now)
  })
}
