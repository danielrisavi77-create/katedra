import { describe, expect, it } from 'vitest'
import { resolveAuthHeaderState } from './header-state'

describe('resolveAuthHeaderState', () => {
  it('keeps a confirmed browser session visible when balance is unavailable', () => {
    expect(resolveAuthHeaderState({ user: { id: 'user-1' }, balanceStatus: 500 })).toEqual({
      loggedIn: true,
      hasPass: false,
      balanceKnown: false,
    })
  })

  it('uses the balance response for Pass status when available', () => {
    expect(resolveAuthHeaderState({ user: { id: 'user-1' }, balanceStatus: 200, balanceData: { hasPass: true } })).toEqual({
      loggedIn: true,
      hasPass: true,
      balanceKnown: true,
    })
  })

  it('marks the header logged out when there is no browser session', () => {
    expect(resolveAuthHeaderState({ user: null, balanceStatus: 200, balanceData: { hasPass: true } })).toEqual({
      loggedIn: false,
      hasPass: false,
      balanceKnown: false,
    })
  })
})
