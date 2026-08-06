import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'

export type TypedAdminClient = SupabaseClient<Database>

// Temporary live-schema discriminator until the shared entitlement contract
// gains real `scope`/`capabilities` columns via a canonical Lekta migration.
// Katedra's Stripe webhook grants Project Passes with provider='stripe' and
// product_id=NULL because the Lekta product catalog has no Katedra bundle SKU.
// Lekta's retail webhook resolves a catalog product and writes its product_id.
const KATEDRA_PASS_PROVIDER = 'stripe'

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
    .eq('provider', KATEDRA_PASS_PROVIDER)
    .is('product_id', null)
    .eq('status', 'active')
    .gt('purchase_expires_at', now.toISOString())
    .limit(1)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}
