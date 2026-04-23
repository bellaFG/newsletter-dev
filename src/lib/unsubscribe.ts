import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { isValidEmailAddress, normalizeEmailAddress } from './email'
import { readEnv, requireEnv } from './env'

const TOKEN_VERSION_V1 = 'v1'
const TOKEN_VERSION_V2 = 'v2'
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const DEFAULT_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000

export type UnsubscribeTokenDetails = {
  email: string | null
  expired: boolean
  version: 'v1' | 'v2' | null
}

function toBase64Url(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString('base64url')
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

function getUnsubscribeKey(): Buffer {
  const secret = readEnv('UNSUBSCRIBE_TOKEN_SECRET') ?? requireEnv('NEWSLETTER_API_SECRET')

  return createHash('sha256').update(`devpulse-unsubscribe:${secret}`).digest()
}

export function createUnsubscribeToken(email: string): string {
  const normalizedEmail = normalizeEmailAddress(email)
  const payload = Buffer.from(
    JSON.stringify({
      email: normalizedEmail,
      exp: Math.floor((Date.now() + DEFAULT_TOKEN_TTL_MS) / 1000),
      v: TOKEN_VERSION_V2,
    }),
    'utf8'
  )

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', getUnsubscribeKey(), iv)
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [TOKEN_VERSION_V2, toBase64Url(iv), toBase64Url(encrypted), toBase64Url(authTag)].join('.')
}

export function readUnsubscribeTokenDetails(token: string): UnsubscribeTokenDetails {
  const [version, ivValue, encryptedValue, authTagValue] = token.split('.')

  if (
    (version !== TOKEN_VERSION_V1 && version !== TOKEN_VERSION_V2) ||
    !ivValue ||
    !encryptedValue ||
    !authTagValue
  ) {
    return { email: null, expired: false, version: null }
  }

  try {
    const iv = fromBase64Url(ivValue)
    const encrypted = fromBase64Url(encryptedValue)
    const authTag = fromBase64Url(authTagValue)

    if (iv.byteLength !== IV_BYTES || authTag.byteLength !== AUTH_TAG_BYTES) {
      return { email: null, expired: false, version: null }
    }

    const decipher = createDecipheriv('aes-256-gcm', getUnsubscribeKey(), iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    const payload = JSON.parse(decrypted) as { email?: string; exp?: number; v?: string }
    const email = normalizeEmailAddress(payload.email ?? '')

    if (payload.v !== version || !isValidEmailAddress(email)) {
      return { email: null, expired: false, version: null }
    }

    if (version === TOKEN_VERSION_V2) {
      if (typeof payload.exp !== 'number') {
        return { email: null, expired: false, version: TOKEN_VERSION_V2 }
      }

      if (payload.exp <= Math.floor(Date.now() / 1000)) {
        return { email: null, expired: true, version: TOKEN_VERSION_V2 }
      }
    }

    return { email, expired: false, version }
  } catch {
    return { email: null, expired: false, version: null }
  }
}

export function readUnsubscribeToken(token: string): string | null {
  const details = readUnsubscribeTokenDetails(token)
  return details.expired ? null : details.email
}
