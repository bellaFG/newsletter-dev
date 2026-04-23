import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { AstroCookies } from 'astro'
import { readEnv, requireEnv } from './env'

const ADMIN_SESSION_COOKIE = 'devpulse-admin-session'
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12
const ADMIN_SESSION_IDLE_TIMEOUT_SECONDS = 60 * 30
const ADMIN_SESSION_VERSION = 'v2'

type AdminSessionPayload = {
  v: string
  exp: number
  seen: number
}

function safeCompare(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  return timingSafeEqual(Buffer.from(left), Buffer.from(right))
}

export function getAdminSecret(): string {
  return readEnv('ADMIN_API_SECRET') ?? requireEnv('NEWSLETTER_API_SECRET')
}

export function isValidAdminSecret(candidate: string): boolean {
  return safeCompare(candidate, getAdminSecret())
}

function getSessionSigningKey(): Buffer {
  return createHash('sha256')
    .update(`devpulse-admin-session:${getAdminSecret()}`)
    .digest()
}

function createSessionValue(now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({
      v: ADMIN_SESSION_VERSION,
      exp: now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
      seen: now,
    } satisfies AdminSessionPayload),
    'utf8',
  ).toString('base64url')

  const signature = createHmac('sha256', getSessionSigningKey())
    .update(payload)
    .digest('base64url')

  return `${payload}.${signature}`
}

function readSessionPayload(value: string | undefined): AdminSessionPayload | null {
  if (!value) return null

  const [payloadValue, signature] = value.split('.')
  if (!payloadValue || !signature) return null

  const expectedSignature = createHmac('sha256', getSessionSigningKey())
    .update(payloadValue)
    .digest('base64url')

  if (!safeCompare(signature, expectedSignature)) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadValue, 'base64url').toString('utf8'),
    ) as Partial<AdminSessionPayload>

    if (
      payload.v !== ADMIN_SESSION_VERSION ||
      typeof payload.exp !== 'number' ||
      typeof payload.seen !== 'number'
    ) {
      return null
    }

    const now = Date.now()
    if (payload.exp <= now) return null
    if (payload.seen + ADMIN_SESSION_IDLE_TIMEOUT_SECONDS * 1000 <= now) return null

    return payload as AdminSessionPayload
  } catch {
    return null
  }
}

export function hasAdminSession(cookies: AstroCookies): boolean {
  return Boolean(readSessionPayload(cookies.get(ADMIN_SESSION_COOKIE)?.value))
}

function setAdminSessionCookie(cookies: AstroCookies): void {
  cookies.set(ADMIN_SESSION_COOKIE, createSessionValue(), {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: import.meta.env.PROD,
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  })
}

export function setAdminSession(cookies: AstroCookies): void {
  setAdminSessionCookie(cookies)
}

export function refreshAdminSession(cookies: AstroCookies): void {
  setAdminSessionCookie(cookies)
}

export function clearAdminSession(cookies: AstroCookies): void {
  cookies.delete(ADMIN_SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: import.meta.env.PROD,
  })
}
