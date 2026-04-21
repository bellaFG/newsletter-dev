/**
 * Constantes centralizadas do site e newsletter.
 * Evita strings hardcoded espalhadas por paginas, layouts e templates de email.
 */

export const SITE_NAME = 'DevPulse'
export const SITE_TAGLINE = 'Curadoria dev em portugu\u00eas'
export const SITE_TITLE = 'DevPulse \u2014 Newsletter semanal para devs brasileiros'
export const SITE_DESCRIPTION =
  'Curadoria semanal de artigos, ferramentas e tend\u00eancias do mundo dev, traduzida e resumida por IA. Toda segunda-feira.'

/** Subtitulo exibido no masthead do site e no template de email */
export const MASTHEAD_SUBTITLE = 'Newsletter \u00b7 Semanal \u00b7 IA & Dev'

/** Limite de emails por lote de envio */
export const EMAIL_BATCH_SIZE = 100

/** URL de fallback quando SITE_URL nao esta definida */
export const DEFAULT_SITE_URL = 'https://newsletter-dev.vercel.app'

/** Chave usada no localStorage para persistir preferencia de tema */
export const THEME_STORAGE_KEY = 'devpulse-theme'

/** Janela oficial de publicacao da newsletter */
export const PUBLISH_SCHEDULE_UTC_DAY = 1 // segunda-feira
export const PUBLISH_SCHEDULE_UTC_HOUR = 11 // 08:00 BRT
export const PUBLISH_SCHEDULE_UTC_MINUTE = 0
export const PUBLISH_SCHEDULE_LABEL = 'segunda-feira, 08:00 BRT'
