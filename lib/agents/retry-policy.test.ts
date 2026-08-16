import { describe, expect, it } from 'vitest'

import { nextRetryDecision } from './retry-policy'

describe('agent retry policy', () => {
  it('allows exactly three attempts and blocks after the third rejection', () => {
    expect(nextRetryDecision(1, 'needs_revision')).toEqual({ action: 'retry', nextAttempt: 2 })
    expect(nextRetryDecision(2, 'needs_revision')).toEqual({ action: 'retry', nextAttempt: 3 })
    expect(nextRetryDecision(3, 'needs_revision')).toEqual({ action: 'blocked', nextAttempt: 3 })
  })

  it('does not retry verified or explicitly failed results', () => {
    expect(nextRetryDecision(1, 'verified')).toEqual({ action: 'complete', nextAttempt: 1 })
    expect(nextRetryDecision(1, 'failed')).toEqual({ action: 'failed', nextAttempt: 1 })
  })
})
