import sgMail from '@sendgrid/mail'
import { requireEnv } from './env'

sgMail.setApiKey(requireEnv('SENDGRID_API_KEY'))

/** Cliente SendGrid para envio de emails — APENAS server-side */
export { sgMail }
