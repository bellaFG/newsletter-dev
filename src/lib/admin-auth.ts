import { createHash, timingSafeEqual } from 'node:crypto'
import type { AstroCookies } from 'astro'
import { readEnv, requireEnv } from './env'

const ADMIN_SESSION_COOKIE = 'devpulse-admin-session'
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12

function safeCompare(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  return timingSafeEqual(Buffer.from(left), Buffer.from(right))
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

export function getAdminSecret(): string {
  return readEnv('ADMIN_API_SECRET') ?? requireEnv('NEWSLETTER_API_SECRET')
}

export function isValidAdminSecret(candidate: string): boolean {
  return safeCompare(candidate, getAdminSecret())
}

export function hasAdminSession(cookies: AstroCookies): boolean {
  const session = cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!session) return false

  return safeCompare(session, hashSecret(getAdminSecret()))
}

export function setAdminSession(cookies: AstroCookies): void {
  cookies.set(ADMIN_SESSION_COOKIE, hashSecret(getAdminSecret()), {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: import.meta.env.PROD,
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  })
}

export function clearAdminSession(cookies: AstroCookies): void {
  cookies.delete(ADMIN_SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: import.meta.env.PROD,
  })
}
