import type { ProjectCapability, ProductTier } from './lifecycle'

export const PRODUCT_CAPABILITIES: Record<ProductTier, readonly ProjectCapability[]> = {
  free: ['completion_scan', 'basic_plan', 'lekta_free_check', 'contextual_ai'],
  seminarski: [
    'completion_scan', 'basic_plan', 'lekta_free_check', 'contextual_ai', 'section_writing',
    'full_generation', 'source_suggestions', 'mentor_review',
  ],
  zavrsni: [
    'completion_scan', 'basic_plan', 'lekta_free_check', 'contextual_ai', 'section_writing',
    'full_generation', 'source_suggestions', 'web_research', 'mentor_review',
    'methodology', 'defense_simulator', 'autonomous_run',
  ],
  diplomski: [
    'completion_scan', 'basic_plan', 'lekta_free_check', 'contextual_ai', 'section_writing',
    'full_generation', 'source_suggestions', 'web_research', 'mentor_review',
    'methodology', 'research_design', 'data_analysis', 'multiple_reviews',
    'defense_simulator', 'autonomous_run',
  ],
}

export function hasProductCapability(tier: ProductTier, capability: ProjectCapability): boolean {
  return PRODUCT_CAPABILITIES[tier].includes(capability)
}

export type CapabilityDecision =
  | { allowed: true; tier: ProductTier; projectId: string; adminOverride?: boolean; unlimited?: boolean }
  | {
      allowed: false
      code: 'unauthenticated' | 'project_not_owned' | 'pass_required' | 'policy_unverified' | 'capability_unavailable'
      projectId: string
      tier: ProductTier
    }

export interface CapabilityContext {
  userId: string
  projectId: string
  ownedProjectId?: string | null
  lockedProductKey?: ProductTier | null
  hasActivePass?: boolean
  verifiedPolicy?: boolean
  adminOverride?: boolean
}

/** Pure decision layer used by server routes and unit tests. */
export function decideProjectCapability(
  context: CapabilityContext,
  capability: ProjectCapability,
): CapabilityDecision {
  const tier = context.lockedProductKey || 'free'
  if (!context.userId) return { allowed: false, code: 'unauthenticated', projectId: context.projectId, tier }
  if (!context.ownedProjectId || context.ownedProjectId !== context.projectId) {
    return { allowed: false, code: 'project_not_owned', projectId: context.projectId, tier }
  }

  // This is an explicit server-side support override, not a product Pass.
  // Ownership is checked above so the override cannot cross project boundaries.
  if (context.adminOverride === true) {
    return {
      allowed: true,
      tier: 'diplomski',
      projectId: context.projectId,
      adminOverride: true,
      unlimited: true,
    }
  }

  const freeCapability = tier === 'free' && ['completion_scan', 'basic_plan', 'lekta_free_check', 'contextual_ai'].includes(capability)
  if (!freeCapability && !context.lockedProductKey) {
    return { allowed: false, code: 'pass_required', projectId: context.projectId, tier }
  }
  if (context.lockedProductKey && !context.hasActivePass) {
    return { allowed: false, code: 'pass_required', projectId: context.projectId, tier }
  }
  if (context.lockedProductKey && !hasProductCapability(tier, capability)) {
    return { allowed: false, code: 'capability_unavailable', projectId: context.projectId, tier }
  }
  if (capability === 'web_research' && context.verifiedPolicy !== true) {
    return { allowed: false, code: 'policy_unverified', projectId: context.projectId, tier }
  }
  return { allowed: true, tier, projectId: context.projectId }
}
