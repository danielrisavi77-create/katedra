import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'

export type TypedAdminClient = SupabaseClient<Database>

export async function hasActiveProjectPass(
  db: TypedAdminClient,
  input: { userId: string; projectId: string; now?: Date },
): Promise<boolean> {
  const { userId, projectId, now = new Date() } = input

  const { data, error } = await db
    .from('entitlements')
    .select('id')
    .eq('user_id', userId)
    .eq('academic_project_id', projectId)
    .eq('status', 'active')
    .gt('purchase_expires_at', now.toISOString())
    .limit(1)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}
