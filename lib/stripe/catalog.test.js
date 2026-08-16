import { describe, expect, it } from 'vitest'

import { KATEDRA_PACKAGES, getKatedraPackage } from './catalog'

describe('Katedra Stripe catalog', () => {
  it('has one server-side price and token definition per package', () => {
    expect(Object.keys(KATEDRA_PACKAGES)).toEqual(['seminarski', 'zavrsni', 'diplomski'])
    for (const product of Object.values(KATEDRA_PACKAGES)) {
      expect(product.eur).toBeGreaterThan(0)
      expect(product.tokens).toBeGreaterThan(0)
      expect(product.workType).toBeTruthy()
    }
  })

  it('rejects unknown products', () => {
    expect(getKatedraPackage('unknown')).toBeNull()
  })
})
