import { describe, expect, it } from 'vitest'

import { decideProjectCapability, hasProductCapability, PRODUCT_CAPABILITIES } from './capabilities'
import { productTierForWorkType } from './lifecycle'

describe('product capability matrix', () => {
  it('keeps the free tier limited to planning, free checks and contextual coaching', () => {
    expect(PRODUCT_CAPABILITIES.free).toEqual(['completion_scan', 'basic_plan', 'lekta_free_check', 'contextual_ai'])
    expect(hasProductCapability('free', 'section_writing')).toBe(false)
    expect(hasProductCapability('free', 'contextual_ai')).toBe(true)
  })

  it('gives seminarski a writing workflow without methodology or defense', () => {
    expect(hasProductCapability('seminarski', 'section_writing')).toBe(true)
    expect(hasProductCapability('seminarski', 'methodology')).toBe(false)
    expect(hasProductCapability('seminarski', 'defense_simulator')).toBe(false)
  })

  it('adds research design and methodology to the final and graduate workflows', () => {
    for (const tier of ['zavrsni', 'diplomski'] as const) {
      expect(hasProductCapability(tier, 'section_writing')).toBe(true)
      expect(hasProductCapability(tier, 'full_generation')).toBe(true)
      expect(hasProductCapability(tier, 'methodology')).toBe(true)
      expect(hasProductCapability(tier, 'research_design')).toBe(true)
      expect(hasProductCapability(tier, 'data_analysis')).toBe(false)
      expect(hasProductCapability(tier, 'multiple_reviews')).toBe(false)
      expect(hasProductCapability(tier, 'defense_simulator')).toBe(false)
      expect(hasProductCapability(tier, 'web_research')).toBe(false)
      expect(hasProductCapability(tier, 'autonomous_run')).toBe(false)
    }
  })

  it('maps legacy and canonical work types to the same product tier', () => {
    expect(productTierForWorkType('s')).toBe('seminarski')
    expect(productTierForWorkType('final')).toBe('zavrsni')
    expect(productTierForWorkType('diplomski')).toBe('diplomski')
    expect(productTierForWorkType('unknown')).toBeNull()
  })

  it('requires ownership before granting a free capability', () => {
    expect(decideProjectCapability({ userId: 'u1', projectId: 'p1' }, 'basic_plan')).toMatchObject({ allowed: false, code: 'project_not_owned' })
  })

  it('requires a Pass for paid capabilities', () => {
    expect(decideProjectCapability({ userId: 'u1', projectId: 'p1', ownedProjectId: 'p1' }, 'section_writing')).toMatchObject({ allowed: false, code: 'pass_required' })
  })

  it('fails closed for an expired or missing Pass', () => {
    expect(decideProjectCapability({ userId: 'u1', projectId: 'p1', ownedProjectId: 'p1', lockedProductKey: 'zavrsni', hasActivePass: false, researchModulesEnabled: true, verifiedAcademicProfile: true }, 'methodology')).toMatchObject({ allowed: false, code: 'pass_required' })
  })

  it('requires the research flag and a verified academic profile', () => {
    const base = { userId: 'u1', projectId: 'p1', ownedProjectId: 'p1', lockedProductKey: 'zavrsni' as const, hasActivePass: true }
    expect(decideProjectCapability({ ...base, researchModulesEnabled: false, verifiedAcademicProfile: true }, 'research_design')).toMatchObject({ allowed: false, code: 'capability_unavailable' })
    expect(decideProjectCapability({ ...base, researchModulesEnabled: true, verifiedAcademicProfile: false }, 'research_design')).toMatchObject({ allowed: false, code: 'capability_unavailable' })
    expect(decideProjectCapability({ ...base, researchModulesEnabled: true, verifiedAcademicProfile: true }, 'research_design')).toMatchObject({ allowed: true, tier: 'zavrsni' })
    expect(decideProjectCapability({ ...base, researchModulesEnabled: true, verifiedAcademicProfile: true }, 'methodology')).toMatchObject({ allowed: true, tier: 'zavrsni' })
  })

  it('never exposes the research modules to seminarski projects', () => {
    expect(decideProjectCapability({ userId: 'u1', projectId: 'p1', ownedProjectId: 'p1', lockedProductKey: 'seminarski', hasActivePass: true, researchModulesEnabled: true, verifiedAcademicProfile: true }, 'methodology')).toMatchObject({ allowed: false, code: 'capability_unavailable' })
  })

  it('does not expose web research in the V1 product matrix', () => {
    expect(decideProjectCapability({ userId: 'u1', projectId: 'p1', ownedProjectId: 'p1', lockedProductKey: 'zavrsni', hasActivePass: true, verifiedPolicy: false }, 'web_research')).toMatchObject({ allowed: false, code: 'capability_unavailable' })
  })

  it('does not grant paid capabilities to a non-verified academic profile', () => {
    expect(decideProjectCapability({ userId: 'u1', projectId: 'p1', ownedProjectId: 'p1', lockedProductKey: 'diplomski', hasActivePass: true, verifiedAcademicProfile: false }, 'section_writing')).toMatchObject({ allowed: false, code: 'capability_unavailable' })
  })

  it('rejects a capability outside the locked product scope', () => {
    expect(decideProjectCapability({ userId: 'u1', projectId: 'p1', ownedProjectId: 'p1', lockedProductKey: 'seminarski', hasActivePass: true }, 'defense_simulator')).toMatchObject({ allowed: false, code: 'capability_unavailable' })
  })

  it('allows an explicitly authenticated admin override without inventing a Pass', () => {
    expect(decideProjectCapability({
      userId: 'u1',
      projectId: 'p1',
      ownedProjectId: 'p1',
      adminOverride: true,
    }, 'web_research')).toEqual({
      allowed: true,
      tier: 'diplomski',
      projectId: 'p1',
      adminOverride: true,
      unlimited: true,
    })
  })

  it('keeps ownership mandatory even for an admin override', () => {
    expect(decideProjectCapability({ userId: 'u1', projectId: 'p1', adminOverride: true }, 'full_generation')).toMatchObject({
      allowed: false,
      code: 'project_not_owned',
    })
  })
})
