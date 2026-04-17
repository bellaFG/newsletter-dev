import { requireEnv } from './env'

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

interface BrevoEmail {
  to: string
  from: string
  subject: string
  html: string
}

/**
 * Envia um email via Brevo (ex-Sendinblue) API.
 * Free tier: 300 emails/dia, sem domínio obrigatório.
 */
export async function sendEmail(email: BrevoEmail): Promise<void> {
  const apiKey = requireEnv('BREVO_API_KEY')

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: email.from },
      to: [{ email: email.to }],
      subject: email.subject,
      htmlContent: email.html,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Brevo API error: ${res.status}`)
  }
}
