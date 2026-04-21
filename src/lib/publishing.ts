import { getEditionDisplayDate } from './editions'
import {
  PUBLISH_SCHEDULE_UTC_DAY,
  PUBLISH_SCHEDULE_UTC_HOUR,
  PUBLISH_SCHEDULE_UTC_MINUTE,
} from './config'
import type { Edition } from './types'

type EditionRef = Pick<Edition, 'slug' | 'title' | 'published_at' | 'created_at'>

export type PublishingStatus = {
  isDelayed: boolean
  featuredLabel: string
  featuredCtaLabel: string
}

function getScheduledPublicationForCurrentWeek(now: Date): Date {
  const scheduled = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    PUBLISH_SCHEDULE_UTC_HOUR,
    PUBLISH_SCHEDULE_UTC_MINUTE,
    0,
    0,
  ))

  const daysSinceScheduleDay = (now.getUTCDay() - PUBLISH_SCHEDULE_UTC_DAY + 7) % 7
  scheduled.setUTCDate(scheduled.getUTCDate() - daysSinceScheduleDay)
  return scheduled
}

export function getPublishingStatus(
  latestEdition: EditionRef | null,
  now = new Date(),
): PublishingStatus {
  const scheduledAt = getScheduledPublicationForCurrentWeek(now)
  const latestPublishedAt = latestEdition
    ? new Date(getEditionDisplayDate(latestEdition)).getTime()
    : null
  const isDelayed =
    now.getTime() >= scheduledAt.getTime() &&
    (latestPublishedAt === null || latestPublishedAt < scheduledAt.getTime())

  return {
    isDelayed,
    featuredLabel: isDelayed ? 'Última edição publicada' : 'Newsletter Semanal',
    featuredCtaLabel: isDelayed
      ? latestEdition ? 'Ler última edição publicada →' : 'Ver arquivo →'
      : 'Ler edição completa →',
  }
}
