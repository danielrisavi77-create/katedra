import { describe, expect, it } from 'vitest'

import { estimateChatCharge, maxAffordableOutputTokens, validateCostCeiling } from './cost-policy'

const base = {
  balance: 10_000,
  minimumBalance: 100,
  estimatedCharge: 500,
  dailyUsed: 1_000,
  dailyCeiling: 100_000,
  activeStreams: 0,
  maxActiveStreams: 2,
  inputChars: 2_000,
  maxInputChars: 20_000,
}

describe('validateCostCeiling', () => {
  it('accepts a request inside every configured ceiling', () => {
    expect(validateCostCeiling(base)).toEqual({ ok: true })
  })

  it('rejects an oversized input before provider streaming', () => {
    expect(validateCostCeiling({ ...base, inputChars: 20_001 })).toEqual({
      ok: false,
      reason: 'request_too_large',
      status: 413,
    })
  })

  it('counts attachment payload toward the input ceiling', () => {
    expect(validateCostCeiling({ ...base, attachmentChars: 28_000_001 })).toEqual({
      ok: false,
      reason: 'request_too_large',
      status: 413,
    })
  })

  it('rejects a request that would cross the daily user ceiling', () => {
    expect(validateCostCeiling({ ...base, dailyUsed: 99_600, estimatedCharge: 500 })).toEqual({
      ok: false,
      reason: 'daily_ceiling',
      status: 429,
    })
  })

  it('rejects a request that cannot fit the remaining wallet safety balance', () => {
    expect(validateCostCeiling({ ...base, balance: 400, estimatedCharge: 350 })).toEqual({
      ok: false,
      reason: 'insufficient_balance',
      status: 402,
    })
  })

  it('rejects a third active stream', () => {
    expect(validateCostCeiling({ ...base, activeStreams: 2 })).toEqual({
      ok: false,
      reason: 'concurrency',
      status: 429,
    })
  })
})

describe('estimateChatCharge', () => {
  it('uses a bounded full-output estimate and the model multiplier', () => {
    expect(estimateChatCharge({
      inputChars: 4_000,
      attachmentChars: 0,
      model: 'claude-sonnet-5',
      maxOutputTokens: 2_000,
      outputWeight: 5,
    })).toBe(11_000)

    expect(estimateChatCharge({
      inputChars: 4_000,
      attachmentChars: 0,
      model: 'claude-haiku-4-5-20251001',
      maxOutputTokens: 2_000,
      outputWeight: 5,
    })).toBe(3_667)
  })
})

describe('maxAffordableOutputTokens', () => {
  it('keeps a small starter wallet usable without exceeding its safety floor', () => {
    expect(maxAffordableOutputTokens({
      balance: 5_000,
      minimumBalance: 2_000,
      inputChars: 100,
      model: 'claude-sonnet-5',
      outputWeight: 5,
      maxOutputTokens: 8_192,
    })).toBe(595)
  })

  it('caps a large wallet at the provider maximum', () => {
    expect(maxAffordableOutputTokens({
      balance: 1_500_000,
      minimumBalance: 2_000,
      inputChars: 100,
      model: 'claude-sonnet-5',
      outputWeight: 5,
      maxOutputTokens: 8_192,
    })).toBe(8_192)
  })
})
