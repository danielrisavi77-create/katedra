import { describe, expect, it } from 'vitest'

import { FUTURE_PRODUCT_MODULES, PAID_V1_MODULES, passModulesForWorkType } from './v1-modules'

describe('paid V1 product modules', () => {
  it('lists only modules that have a real surface and user action', () => {
    expect(PAID_V1_MODULES.map((module) => module.id)).toEqual([
      'project_plan',
      'manuscript_sections',
      'contextual_ai',
      'sources_verification',
      'mentor_tasks',
      'local_versions',
      'ai_ledger',
      'lekta_handoff',
    ])

    for (const entry of PAID_V1_MODULES) {
      expect(entry.label).toBeTruthy()
      expect(entry.surface).toBeTruthy()
      expect(entry.actionLabel).toBeTruthy()
      expect(entry.persistence).toBeTruthy()
    }
  })

  it('uses the same honest V1 scope for every paid work type', () => {
    expect(passModulesForWorkType('s')).toEqual(PAID_V1_MODULES)
    expect(passModulesForWorkType('z')).toEqual(PAID_V1_MODULES)
    expect(passModulesForWorkType('d')).toEqual(PAID_V1_MODULES)
  })

  it('keeps future research and defense products out of the paid V1 list', () => {
    expect(FUTURE_PRODUCT_MODULES.map((module) => module.id)).toEqual([
      'research_design_canvas',
      'methodology_builder',
      'evidence_matrix',
      'mentor_review_cycles',
      'defense_simulator',
    ])
    expect(PAID_V1_MODULES.some((module) => /obrana|istraživački dizajn|metodologija/u.test(module.label))).toBe(false)
  })
})
