import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { katedraPassProductFilter } from '../../katedra-pass-catalog.js'

export type TypedAdminClient = SupabaseClient<Database>

const KATEDRA_PASS_PROVIDER = 'stripe'

export type ProjectPassLookup =
  | { ok: true; active: boolean }
  | { ok: false; error: string }

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export async function lookupActiveProjectPass(
  db: TypedAdminClient,
  input: { userId: string; projectId: string; now?: Date },
): Promise<ProjectPassLookup> {
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
    const message = errorMessage(error, 'Project Pass lookup failed.')
    console.error(JSON.stringify({ eventName: 'project_pass_lookup_failed', userId, projectId, error: message }))
    return { ok: false, error: message }
  }
  if (result.error) {
    console.error(JSON.stringify({ eventName: 'project_pass_lookup_failed', userId, projectId, error: result.error.message }))
    return { ok: false, error: result.error.message || 'Project Pass lookup failed.' }
  }
  return { ok: true, active: Boolean(result.data) }
}

export async function hasActiveProjectPass(
  db: TypedAdminClient,
  input: { userId: string; projectId: string; now?: Date },
): Promise<boolean> {
  const result = await lookupActiveProjectPass(db, input)
  return result.ok && result.active
}

export async function lookupActiveProjectPassForProduct(
  db: TypedAdminClient,
  input: { userId: string; projectId: string; productId: string; now?: Date },
): Promise<ProjectPassLookup> {
  const { userId, projectId, productId, now = new Date() } = input
  const workType = workTypeForProductId(productId)
  if (!workType) return { ok: true, active: false }

  try {
    const exact = await db
      .from('entitlements')
      .select('id, product_id, work_type')
      .eq('user_id', userId)
      .eq('academic_project_id', projectId)
      .eq('provider', KATEDRA_PASS_PROVIDER)
      .eq('product_id', productId)
      .eq('status', 'active')
      .gt('purchase_expires_at', now.toISOString())
      .limit(1)
      .maybeSingle()

    if (exact.error) {
      console.error(JSON.stringify({ eventName: 'project_pass_product_lookup_failed', userId, projectId, productId, error: exact.error.message }))
      return { ok: false, error: exact.error.message || 'Project Pass product lookup failed.' }
    }
    if (exact.data?.product_id === productId) return { ok: true, active: true }

    // Older Katedra Pass rows predate the shared SKU catalog and intentionally
    // have a NULL product_id. They remain valid only when their canonical
    // work_type matches this exact product tier.
    const legacy = await db
      .from('entitlements')
      .select('id, product_id, work_type')
      .eq('user_id', userId)
      .eq('academic_project_id', projectId)
      .eq('provider', KATEDRA_PASS_PROVIDER)
      .is('product_id', null)
      .eq('work_type', workType)
      .eq('status', 'active')
      .gt('purchase_expires_at', now.toISOString())
      .limit(1)
      .maybeSingle()

    if (legacy.error) {
      console.error(JSON.stringify({ eventName: 'project_pass_legacy_product_lookup_failed', userId, projectId, productId, error: legacy.error.message }))
      return { ok: false, error: legacy.error.message || 'Legacy Project Pass lookup failed.' }
    }
    return { ok: true, active: legacy.data?.product_id === null && legacy.data?.work_type === workType }
  } catch (error) {
    const message = errorMessage(error, 'Project Pass product lookup failed.')
    console.error(JSON.stringify({ eventName: 'project_pass_product_lookup_failed', userId, projectId, productId, error: message }))
    return { ok: false, error: message }
  }
}

export async function hasActiveProjectPassForProduct(
  db: TypedAdminClient,
  input: { userId: string; projectId: string; productId: string; now?: Date },
): Promise<boolean> {
  const result = await lookupActiveProjectPassForProduct(db, input)
  return result.ok && result.active
}

function workTypeForProductId(productId: string): 'seminarski' | 'zavrsni' | 'diplomski' | null {
  if (productId === 'katedra_pass_seminarski') return 'seminarski'
  if (productId === 'katedra_pass_zavrsni') return 'zavrsni'
  if (productId === 'katedra_pass_diplomski') return 'diplomski'
  return null
}
