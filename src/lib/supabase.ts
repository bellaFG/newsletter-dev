import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'
import { requireEnv } from './env'

/** Cliente publico (anon key) — seguro para uso em paginas server-side */
export const supabase = createClient<Database>(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_ANON_KEY'),
)

/**
 * Cliente com service role — APENAS para API routes (server-side).
 * Bypassa RLS e tem acesso total ao banco. Nunca expor no client.
 */
export function createServerClient() {
  return createClient<Database>(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )
}
