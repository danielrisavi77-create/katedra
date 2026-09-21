import { describe, expect, it } from 'vitest'

import { resolveBillingOutcome } from './billing-contract'

describe('resolveBillingOutcome', () => {
  it('settles only when usage exists and the RPC confirms settlement', () => {
    expect(resolveBillingOutcome({
      provider: 'completed',
      usage: { inputTokens: 20, outputTokens: 5 },
      rpc: 'settled',
    })).toEqual({ state: 'settled', retry: false })
  })

  it('treats a repeated already-settled response as a successful idempotent retry', () => {
    expect(resolveBillingOutcome({
      provider: 'completed',
      usage: { inputTokens: 20, outputTokens: 5 },
      rpc: 'already_settled',
    })).toEqual({ state: 'settled', retry: false })
  })

  it('never turns missing usage into a zero-cost success', () => {
    expect(resolveBillingOutcome({
      provider: 'completed',
      usage: { inputTokens: 0, outputTokens: 0 },
      rpc: 'settled',
    })).toEqual({ state: 'pending_reconciliation', retry: true, reason: 'usage_unavailable' })
  })

  it('releases a provider failure that happened before any usage was observed', () => {
    expect(resolveBillingOutcome({
      provider: 'failed',
      usage: { inputTokens: 0, outputTokens: 0 },
      rpc: 'released',
    })).toEqual({ state: 'released', retry: false })
  })

  it('keeps a timed out settlement in reconciliation instead of charging blindly', () => {
    expect(resolveBillingOutcome({
      provider: 'aborted',
      usage: { inputTokens: 20, outputTokens: 5 },
      rpc: 'timeout',
    })).toEqual({ state: 'pending_reconciliation', retry: true, reason: 'rpc_timeout' })
  })

  it('does not retry a known released outcome', () => {
    expect(resolveBillingOutcome({
      provider: 'aborted',
      usage: { inputTokens: 20, outputTokens: 5 },
      rpc: 'released',
    })).toEqual({ state: 'released', retry: false })
  })
})
