import type { SupabaseClient } from '@supabase/supabase-js'

import { readProjectLock } from '../academic-suite/project-lock'
import { resolveOwnedProject } from '../academic-suite/repositories/projects'
import { hasActiveProjectPassForProduct } from '../academic-suite/repositories/entitlements'
import { productTierForWorkType, type ProjectCapability, type ProductTier } from './lifecycle'
import { decideProjectCapability, type CapabilityDecision } from './capabilities'

type CapabilityDb = SupabaseClient<any>

export async function resolveProjectCapability(
  db: CapabilityDb,
  input: { userId: string; projectId: string; capability: ProjectCapability },
): Promise<CapabilityDecision> {
  const authenticatedUserId = await authenticatedUserIdFrom(db)
  if (!authenticatedUserId || authenticatedUserId !== input.userId) {
    return { allowed: false, code: 'unauthenticated', projectId: input.projectId, tier: 'free' }
  }
  const owned = await resolveOwnedProject(db, {
    userId: input.userId,
    projectId: input.projectId,
    allowGuestAlias: false,
  })
  if (!owned) {
    return { allowed: false, code: 'project_not_owned', projectId: input.projectId, tier: 'free' }
  }

  const lockResult = await readProjectLock(db, { userId: input.userId, projectId: owned.projectId })
  const lock = lockResult.ok ? lockResult.lock : null
  const lockedProductKey = normalizeProductTier(lock?.productKey)
  if (lock && productTierForWorkType(lock.workType) !== lockedProductKey) {
    return { allowed: false, code: 'capability_unavailable', projectId: owned.projectId, tier: lockedProductKey || 'free' }
  }
  const hasActivePass = lockedProductKey
    ? await hasActiveProjectPassForProduct(db, { userId: input.userId, projectId: owned.projectId, productId: productIdForTier(lockedProductKey) })
    : false

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

async function authenticatedUserIdFrom(db: CapabilityDb): Promise<string | null> {
  try {
    if (typeof db.auth?.getUser !== 'function') return null
    const result = await db.auth.getUser()
    return result.data?.user?.id || null
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
