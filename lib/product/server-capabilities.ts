import type { SupabaseClient } from '@supabase/supabase-js'

import { readProjectLock } from '@/lib/academic-suite/project-lock'
import { resolveOwnedProject } from '@/lib/academic-suite/repositories/projects'
import { hasActiveProjectPass } from '@/lib/academic-suite/repositories/entitlements'
import type { ProjectCapability, ProductTier } from './lifecycle'
import { decideProjectCapability, type CapabilityDecision } from './capabilities'

type CapabilityDb = SupabaseClient<any>

export async function resolveProjectCapability(
  db: CapabilityDb,
  input: { userId: string; projectId: string; capability: ProjectCapability; verifiedPolicy?: boolean },
): Promise<CapabilityDecision> {
  const owned = await resolveOwnedProject(db, {
    userId: input.userId,
    projectId: input.projectId,
    allowGuestAlias: false,
  })
  if (!owned) {
    return { allowed: false, code: 'project_not_owned', projectId: input.projectId, tier: 'free' }
  }

  const lockResult = await readProjectLock(db, { userId: input.userId, projectId: owned.projectId })
  const lockedProductKey = lockResult.ok ? normalizeProductTier(lockResult.lock?.productKey) : null
  const hasActivePass = lockedProductKey
    ? await hasActiveProjectPass(db, { userId: input.userId, projectId: owned.projectId })
    : false

  return decideProjectCapability({
    userId: input.userId,
    projectId: owned.projectId,
    ownedProjectId: owned.projectId,
    lockedProductKey,
    hasActivePass,
    verifiedPolicy: input.verifiedPolicy,
  }, input.capability)
}

function normalizeProductTier(value: unknown): Exclude<ProductTier, 'free'> | null {
  if (value === 'seminarski' || value === 'zavrsni' || value === 'diplomski') return value
  return null
}
