import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../academic-suite/database.types'

/** A uniqueness error alone does not identify which purchase already exists. */
export async function isSameStripeEntitlementPurchase(
  db: Pick<SupabaseClient<Database>, 'from'>,
  purchase: { userId: string; projectId: string; sessionId: string; productId: string; workType: string },
): Promise<boolean> {
  try {
    const { data, error } = await db.from('entitlements')
      .select('id, user_id, academic_project_id, provider, order_id, product_id, work_type')
      .eq('provider', 'stripe')
      .eq('order_id', purchase.sessionId)
      .maybeSingle()
    // This is purchase identity, not an access decision: an expired original
    // purchase still needs its interrupted, idempotent wallet grant reconciled.
    return !error && !!data && typeof data.id === 'string' && !!data.id.trim()
      && data.user_id === purchase.userId
      && data.academic_project_id === purchase.projectId
      && data.provider === 'stripe'
      && data.order_id === purchase.sessionId
      && data.product_id === purchase.productId
      && data.work_type === purchase.workType
  } catch {
    return false
  }
}
