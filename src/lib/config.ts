/**
 * Constantes centralizadas do site e newsletter.
 * Evita strings hardcoded espalhadas por paginas, layouts e templates de email.
 */

export const SITE_NAME = 'DevPulse'
export const SITE_TAGLINE = 'Curadoria dev em portugu\u00eas'
export const SITE_DESCRIPTION =
  'Curadoria semanal de artigos, ferramentas e tend\u00eancias do mundo dev, traduzida e resumida por IA. Toda segunda-feira.'

/** Subtitulo exibido no masthead do site e no template de email */
export const MASTHEAD_SUBTITLE = 'Newsletter \u00b7 Semanal \u00b7 IA & Dev'

/** Limite de emails por lote de envio */
export const EMAIL_BATCH_SIZE = 100

/** URL de fallback quando SITE_URL nao esta definida */
export const DEFAULT_SITE_URL = 'https://newsletter-dev.vercel.app'

const LOCAL_SITE_HOSTS = new Set(['localhost', '0.0.0.0', '::1', '[::1]'])

/**
 * Normaliza a URL publica usada em emails e links externos.
 * Nunca propaga hosts locais para envios reais.
 */
export function normalizePublicSiteUrl(value: string | undefined): string {
  const rawValue = value?.trim()
  if (!rawValue) return DEFAULT_SITE_URL

  try {
    const url = new URL(rawValue)
    const hostname = url.hostname.toLowerCase()

    if (!['http:', 'https:'].includes(url.protocol)) {
      return DEFAULT_SITE_URL
    }

    if (LOCAL_SITE_HOSTS.has(hostname) || hostname.startsWith('127.')) {
      return DEFAULT_SITE_URL
    }

    const pathname = url.pathname.replace(/\/+$/, '')
    return `${url.origin}${pathname === '/' ? '' : pathname}`
  } catch {
    return DEFAULT_SITE_URL
  }
}

/** Chave usada no localStorage para persistir preferencia de tema */
export const THEME_STORAGE_KEY = 'devpulse-theme'

/** Janela oficial de publicacao da newsletter */
export const PUBLISH_SCHEDULE_LABEL = 'segunda-feira às 8h00'
