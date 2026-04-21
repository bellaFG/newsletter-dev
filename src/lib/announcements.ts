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
  priority?: number
  revision?: string
  dismissible?: boolean
}

function hashAnnouncementVersion(value: string): string {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }

  return Math.abs(hash).toString(36)
}

export function getAnnouncementDismissStorageKey(announcement: SiteAnnouncement): string {
  const version = announcement.revision ?? [
    announcement.scope,
    announcement.startsAt ?? '',
    announcement.endsAt ?? '',
    announcement.title,
    announcement.message,
    announcement.note ?? '',
    announcement.ctaHref ?? '',
    announcement.ctaLabel ?? '',
  ].join('|')

  return `devpulse-announcement-dismissed:${announcement.id}:${hashAnnouncementVersion(version)}`
}
