import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { readEnv, requireEnv } from './env'

const TOKEN_VERSION = 'v1'
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function toBase64Url(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString('base64url')
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function getUnsubscribeKey(): Buffer {
  const secret = readEnv('UNSUBSCRIBE_TOKEN_SECRET') ?? requireEnv('NEWSLETTER_API_SECRET')

  return createHash('sha256').update(`devpulse-unsubscribe:${secret}`).digest()
}

export function createUnsubscribeToken(email: string): string {
  const normalizedEmail = normalizeEmail(email)
  const payload = Buffer.from(
    JSON.stringify({
      email: normalizedEmail,
      v: TOKEN_VERSION,
    }),
    'utf8'
  )

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', getUnsubscribeKey(), iv)
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [TOKEN_VERSION, toBase64Url(iv), toBase64Url(encrypted), toBase64Url(authTag)].join('.')
}

export function readUnsubscribeToken(token: string): string | null {
  const [version, ivValue, encryptedValue, authTagValue] = token.split('.')

  if (version !== TOKEN_VERSION || !ivValue || !encryptedValue || !authTagValue) {
    return null
  }

  try {
    const iv = fromBase64Url(ivValue)
    const encrypted = fromBase64Url(encryptedValue)
    const authTag = fromBase64Url(authTagValue)

    if (iv.byteLength !== IV_BYTES || authTag.byteLength !== AUTH_TAG_BYTES) {
      return null
    }

    const decipher = createDecipheriv('aes-256-gcm', getUnsubscribeKey(), iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    const payload = JSON.parse(decrypted) as { email?: string; v?: string }
    const email = normalizeEmail(payload.email ?? '')

    if (payload.v !== TOKEN_VERSION || !EMAIL_RE.test(email)) {
      return null
    }

    return email
  } catch {
    return null
  }
}
