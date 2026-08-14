import { describe, expect, it, vi } from 'vitest'

import { createWithdrawalReference } from './withdrawal-reference'

describe('createWithdrawalReference', () => {
  it('uses a UUID when browser crypto provides one', () => {
    expect(createWithdrawalReference(() => 'uuid-1')).toBe('uuid-1')
  })

  it('always returns a non-empty bounded fallback', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234)
    expect(createWithdrawalReference(null)).toMatch(/^withdrawal-1234-/)
  })
})
