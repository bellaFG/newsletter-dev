import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'
import { readEnv, requireEnv } from './env'

type DatabaseClient = SupabaseClient<Database>

export type RateLimitRule = {
  limit: number
  windowSec: number
}

export type RateLimitDecision = {
  allowed: boolean
  ipHash: string
  retryAfter: number
}

function getRateLimitSalt(): string {
  return readEnv('RATE_LIMIT_SALT') ?? requireEnv('NEWSLETTER_API_SECRET')
}

export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const cfIp = request.headers.get('cf-connecting-ip')?.trim()
  if (cfIp) return cfIp

  return 'unknown'
}

export function getRequestIpHash(request: Request): string {
  return createHash('sha256')
    .update(`devpulse-rate-limit:${getRateLimitSalt()}:${getRequestIp(request)}`)
    .digest('hex')
}

function getBucketStart(now: Date, windowSec: number): string {
  const bucketMs = windowSec * 1000
  return new Date(Math.floor(now.getTime() / bucketMs) * bucketMs).toISOString()
}

function getRetryAfter(now: Date, windowSec: number): number {
  const windowMs = windowSec * 1000
  const elapsed = now.getTime() % windowMs
  return Math.max(1, Math.ceil((windowMs - elapsed) / 1000))
}

export async function checkRateLimit(
  supabase: DatabaseClient,
  request: Request,
  endpoint: string,
  rules: RateLimitRule[],
): Promise<RateLimitDecision> {
  const ipHash = getRequestIpHash(request)
  const now = new Date()

  for (const rule of rules) {
    const { data, error } = await supabase.rpc('bump_rate_limit_bucket', {
      p_ip_hash: ipHash,
      p_endpoint: endpoint,
      p_window_sec: rule.windowSec,
      p_bucket_start: getBucketStart(now, rule.windowSec),
    })

    if (error) {
      console.error('[rate-limit] Falha ao registrar bucket:', error)
      return { allowed: true, ipHash, retryAfter: 0 }
    }

    const count = Number(data ?? 0)
    if (count > rule.limit) {
      return {
        allowed: false,
        ipHash,
        retryAfter: getRetryAfter(now, rule.windowSec),
      }
    }
  }

  return {
    allowed: true,
    ipHash,
    retryAfter: 0,
  }
}
