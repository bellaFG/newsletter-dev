import type { SiteAnnouncement } from './announcements'
import { getEditionDisplayDate } from './editions'
import {
  PUBLISH_SCHEDULE_LABEL,
  PUBLISH_SCHEDULE_UTC_DAY,
  PUBLISH_SCHEDULE_UTC_HOUR,
  PUBLISH_SCHEDULE_UTC_MINUTE,
} from './config'
import type { Edition } from './types'

type EditionRef = Pick<Edition, 'slug' | 'title' | 'published_at' | 'created_at'>

export type PublishingStatus =
  | {
      isDelayed: false
      featuredLabel: string
      featuredCtaLabel: string
    }
  | {
      isDelayed: true
      announcement: SiteAnnouncement
      featuredLabel: string
      featuredCtaLabel: string
    }

const DELAY_JOKES = [
  {
    title: 'Desligaram a IA da tomada. Ja ligamos de novo.',
    body: 'A pipeline resolveu fazer pair programming com o nada.',
  },
  {
    title: 'O cron saiu para tomar cafe e perdeu a daily.',
    body: 'Estamos trazendo a edicao de volta do limbo dos jobs atrasados.',
  },
  {
    title: 'Teve deploy sem cafeina e a automacao sentiu.',
    body: 'A newsletter desta semana entrou em modo de compilacao contemplativa.',
  },
  {
    title: 'Abriram 73 abas na pipeline e travou tudo.',
    body: 'Estamos fechando as ultimas pop-ups existenciais da automacao.',
  },
]

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

function formatDelayDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days} dia${days === 1 ? '' : 's'}`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 && days === 0) parts.push(`${minutes}min`)

  return parts.length > 0 ? parts.join(' ') : 'alguns minutos'
}

function selectDelayJoke(scheduledAt: Date) {
  const index = Math.abs(Math.floor(scheduledAt.getTime() / 604_800_000)) % DELAY_JOKES.length
  return DELAY_JOKES[index]
}

export function getPublishingStatus(
  latestEdition: EditionRef | null,
  now = new Date(),
): PublishingStatus {
  const scheduledAt = getScheduledPublicationForCurrentWeek(now)

  if (now.getTime() < scheduledAt.getTime()) {
    return {
      isDelayed: false,
      featuredLabel: 'Newsletter Semanal',
      featuredCtaLabel: 'Ler edição completa →',
    }
  }

  const latestPublishedAt = latestEdition
    ? new Date(getEditionDisplayDate(latestEdition)).getTime()
    : null

  if (latestPublishedAt && latestPublishedAt >= scheduledAt.getTime()) {
    return {
      isDelayed: false,
      featuredLabel: 'Newsletter Semanal',
      featuredCtaLabel: 'Ler edição completa →',
    }
  }

  const joke = selectDelayJoke(scheduledAt)
  const delayLabel = formatDelayDuration(now.getTime() - scheduledAt.getTime())

  return {
    isDelayed: true,
    announcement: {
      id: 'publishing-delay',
      scope: 'home',
      tone: 'warning',
      eyebrow: 'Atraso tecnico, sem drama',
      title: joke.title,
      message:
        `${joke.body} A edição desta semana ainda nao foi publicada ` +
        `e ja estamos ${delayLabel} alem do horario previsto (${PUBLISH_SCHEDULE_LABEL}).`,
      note: 'Assim que a nova edicao entrar no ar, o destaque troca automaticamente aqui na home.',
      ctaHref: latestEdition ? `/${latestEdition.slug}` : '/archive',
      ctaLabel: latestEdition ? 'Ler a última edição publicada →' : 'Ver arquivo →',
    },
    featuredLabel: 'Última edição publicada',
    featuredCtaLabel: latestEdition ? 'Ler última edição publicada →' : 'Ver arquivo →',
  }
}
