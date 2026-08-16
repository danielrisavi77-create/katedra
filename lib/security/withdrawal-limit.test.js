import { afterEach, describe, expect, it } from 'vitest'

import { releaseWithdrawalReservation, reserveWithdrawal, resetWithdrawalLimiterForTests } from './withdrawal-limit'

afterEach(() => resetWithdrawalLimiterForTests())

describe('reserveWithdrawal', () => {
  it('rejects a repeated idempotency reference and excessive requests', () => {
    expect(reserveWithdrawal('user-1', 'request-1', 1000)).toMatchObject({ allowed: true })
    expect(reserveWithdrawal('user-1', 'request-1', 1000)).toMatchObject({ allowed: false, reason: 'duplicate' })

    reserveWithdrawal('user-1', 'request-2', 1000)
    reserveWithdrawal('user-1', 'request-3', 1000)
    expect(reserveWithdrawal('user-1', 'request-4', 1000)).toMatchObject({ allowed: false, reason: 'rate' })
  })

  it('allows a retry when the first database insert did not succeed', () => {
    expect(reserveWithdrawal('user-1', 'request-1', 1000)).toMatchObject({ allowed: true })
    releaseWithdrawalReservation('user-1', 'request-1')
    expect(reserveWithdrawal('user-1', 'request-1', 1000)).toMatchObject({ allowed: true })
  })
})
