import { describe, expect, it } from 'vitest'

import { KATEDRA_PASS_PRODUCT_IDS } from '../katedra-pass-catalog.js'
import { KATEDRA_PACKAGES } from '../stripe/catalog.js'
import { PRODUCT_CAPABILITIES } from './capabilities'
import { auditProductPromises, productPromiseForWorkType } from './promise-contract'
import { FUTURE_PRODUCT_MODULES, PAID_V1_MODULES } from './v1-modules'

describe('paid product promise contract', () => {
  it('proves that catalog, checkout metadata, capability gates and Pass UI scope agree', () => {
    const audit = auditProductPromises()

    expect(audit).toEqual({ valid: true, issues: [] })
    expect(Object.keys(KATEDRA_PACKAGES)).toEqual(['seminarski', 'zavrsni', 'diplomski'])

    for (const workType of ['seminarski', 'zavrsni', 'diplomski'] as const) {
      const promise = productPromiseForWorkType(workType)
      expect(promise.productId).toBe(KATEDRA_PACKAGES[workType].productId)
      expect(KATEDRA_PASS_PRODUCT_IDS).toContain(promise.productId)
      expect(promise.capabilities).toEqual(PRODUCT_CAPABILITIES[workType])
      expect(promise.modules).toEqual(PAID_V1_MODULES.map((module) => module.id))
      expect(promise.modules.some((id) => FUTURE_PRODUCT_MODULES.some((module) => module.id === id))).toBe(false)
    }
  })

  it('does not silently invent a promise for an unknown package', () => {
    expect(() => productPromiseForWorkType('nepoznato' as never)).toThrow('Nepoznat proizvod')
  })
})
