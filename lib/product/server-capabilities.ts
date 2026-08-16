import type { SupabaseClient } from '@supabase/supabase-js'

import { readProjectLock } from '../academic-suite/project-lock'
import { resolveOwnedProjectResult } from '../academic-suite/repositories/projects'
import { lookupActiveProjectPassForProduct } from '../academic-suite/repositories/entitlements'
import { isAdminOverrideUser } from '../auth/admin-access'
import { productTierForWorkType, type ProjectCapability, type ProductTier } from './lifecycle'
import { decideProjectCapability, type CapabilityDecision } from './capabilities'

type CapabilityDb = SupabaseClient<any>

export type CanonicalProjectPassDecision =
  | { allowed: true; projectId: string; productKey: Exclude<ProductTier, 'free'> }
  | { allowed: false; code: 'pass_required' | 'capability_unavailable'; projectId: string }

export async function resolveProjectCapability(
  db: CapabilityDb,
  input: { userId: string; projectId: string; capability: ProjectCapability },
): Promise<CapabilityDecision> {
  const authenticatedUser = await authenticatedUserFrom(db)
  if (!authenticatedUser?.id || authenticatedUser.id !== input.userId) {
    return { allowed: false, code: 'unauthenticated', projectId: input.projectId, tier: 'free' }
  }
  const ownedResult = await resolveOwnedProjectResult(db, {
    userId: input.userId,
    projectId: input.projectId,
    allowGuestAlias: false,
  })
  if ('error' in ownedResult) {
    console.error(JSON.stringify({
      eventName: 'project_capability_project_lookup_failed',
      userId: input.userId,
      projectId: input.projectId,
      error: ownedResult.error,
    }))
    return { allowed: false, code: 'capability_unavailable', projectId: input.projectId, tier: 'free' }
  }
  const owned = ownedResult.value
  if (!owned) {
    return { allowed: false, code: 'project_not_owned', projectId: input.projectId, tier: 'free' }
  }

  // Admin access is an explicit server-side support override. It is checked
  // only after canonical ownership, so it cannot become a cross-project key.
  // It also does not create or pretend that a Stripe/Lekta Pass exists.
  if (isAdminOverrideUser(authenticatedUser)) {
    return decideProjectCapability({
      userId: input.userId,
      projectId: owned.projectId,
      ownedProjectId: owned.projectId,
      adminOverride: true,
    }, input.capability)
  }

  const lockResult = await readProjectLock(db, { userId: input.userId, projectId: owned.projectId })
  if (!lockResult.ok) {
    console.error(JSON.stringify({
      eventName: 'project_capability_lock_lookup_failed',
      userId: input.userId,
      projectId: owned.projectId,
      error: 'error' in lockResult ? lockResult.error : 'unknown lock lookup failure',
    }))
    return { allowed: false, code: 'capability_unavailable', projectId: owned.projectId, tier: 'free' }
  }
  const lock = lockResult.lock
  const lockedProductKey = normalizeProductTier(lock?.productKey)
  if (lock && productTierForWorkType(lock.workType) !== lockedProductKey) {
    return { allowed: false, code: 'capability_unavailable', projectId: owned.projectId, tier: lockedProductKey || 'free' }
  }
  const passLookup = lockedProductKey
    ? await lookupActiveProjectPassForProduct(db, { userId: input.userId, projectId: owned.projectId, productId: productIdForTier(lockedProductKey) })
    : { ok: true, active: false } as const
  if (passLookup.ok === false) {
    console.error(JSON.stringify({
      eventName: 'project_capability_entitlement_lookup_failed',
      userId: input.userId,
      projectId: owned.projectId,
      error: passLookup.error,
    }))
    return { allowed: false, code: 'capability_unavailable', projectId: owned.projectId, tier: lockedProductKey || 'free' }
  }
  const hasActivePass = passLookup.active

  return decideProjectCapability({
    userId: input.userId,
    projectId: owned.projectId,
    ownedProjectId: owned.projectId,
    lockedProductKey,
    hasActivePass,
    // No client or route payload can assert institutional policy verification.
    // Until a canonical policy repository is connected, research is blocked.
    verifiedPolicy: false,
  }, input.capability)
}

/**
 * Resolves the paid workflow boundary without applying the support/admin
 * override. Material and agent-run workflows must be backed by the same
 * canonical lock + exact project entitlement that the Lekta RPCs enforce.
 */
export async function resolveCanonicalProjectPass(
  db: CapabilityDb,
  input: { userId: string; projectId: string },
): Promise<CanonicalProjectPassDecision> {
  const lockResult = await readProjectLock(db, input)
  if (!lockResult.ok) {
    console.error(JSON.stringify({
      eventName: 'canonical_project_pass_lock_lookup_failed',
      userId: input.userId,
      projectId: input.projectId,
      error: 'error' in lockResult ? lockResult.error : 'unknown lock lookup failure',
    }))
    return { allowed: false, code: 'capability_unavailable', projectId: input.projectId }
  }
  if (!lockResult.lock) return { allowed: false, code: 'pass_required', projectId: input.projectId }

  const productKey = normalizeProductTier(lockResult.lock.productKey)
  if (!productKey || productTierForWorkType(lockResult.lock.workType) !== productKey) {
    return { allowed: false, code: 'capability_unavailable', projectId: input.projectId }
  }

  const passLookup = await lookupActiveProjectPassForProduct(db, {
    userId: input.userId,
    projectId: input.projectId,
    productId: productIdForTier(productKey),
  })
  if (!passLookup.ok) {
    console.error(JSON.stringify({
      eventName: 'canonical_project_pass_entitlement_lookup_failed',
      userId: input.userId,
      projectId: input.projectId,
      error: 'error' in passLookup ? passLookup.error : 'unknown entitlement lookup failure',
    }))
    return { allowed: false, code: 'capability_unavailable', projectId: input.projectId }
  }
  if (!passLookup.active) return { allowed: false, code: 'pass_required', projectId: input.projectId }
  return { allowed: true, projectId: input.projectId, productKey }
}

async function authenticatedUserFrom(db: CapabilityDb): Promise<{ id: string; email?: string | null; email_confirmed_at?: string | null } | null> {
  try {
    if (typeof db.auth?.getUser !== 'function') return null
    const result = await db.auth.getUser()
    const user = result.data?.user
    return user?.id ? user : null
  } catch {
    return null
  }
}

function productIdForTier(tier: Exclude<ProductTier, 'free'>): string {
  return `katedra_pass_${tier}`
}

function normalizeProductTier(value: unknown): Exclude<ProductTier, 'free'> | null {
  if (value === 'seminarski' || value === 'zavrsni' || value === 'diplomski') return value
  return null
}
