import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { katedraPassProductFilter } from '../../katedra-pass-catalog.js'

export type TypedAdminClient = SupabaseClient<Database>

const KATEDRA_PASS_PROVIDER = 'stripe'

export async function hasActiveProjectPass(
  db: TypedAdminClient,
  input: { userId: string; projectId: string; now?: Date },
): Promise<boolean> {
  const { userId, projectId, now = new Date() } = input

  let result
  try {
    result = await db
      .from('entitlements')
      .select('id')
      .eq('user_id', userId)
      .eq('academic_project_id', projectId)
      .eq('provider', KATEDRA_PASS_PROVIDER)
      .or(katedraPassProductFilter())
      .eq('status', 'active')
      .gt('purchase_expires_at', now.toISOString())
      .limit(1)
      .maybeSingle()
  } catch (error) {
    console.error(JSON.stringify({
      eventName: 'project_pass_lookup_failed', userId, projectId, error: error?.message,
    }))
    return false
  }
  const { data, error } = result

  if (error) {
    console.error(JSON.stringify({
      eventName: 'project_pass_lookup_failed', userId, projectId, error: error.message,
    }))
    return false
  }
  return Boolean(data)
}
