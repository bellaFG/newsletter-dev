import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

type DatabaseClient = SupabaseClient<Database>

type AdminAuditInput = {
  actor: string
  action: string
  targetId?: string | null
  payload?: Record<string, unknown>
}

export async function recordAdminAudit(
  supabase: DatabaseClient,
  input: AdminAuditInput,
): Promise<void> {
  const { error } = await supabase.from('admin_audit_log').insert({
    actor: input.actor,
    action: input.action,
    target_id: input.targetId ?? null,
    payload: input.payload ?? {},
  })

  if (error) {
    console.error('[admin-audit] Falha ao registrar auditoria:', error)
  }
}
