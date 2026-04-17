import { Resend } from 'resend'
import { requireEnv } from './env'

/** Cliente Resend para envio de emails — APENAS server-side */
export const resend = new Resend(requireEnv('RESEND_API_KEY'))
