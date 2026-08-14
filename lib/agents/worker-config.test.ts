import { describe, expect, it } from 'vitest'

import { resolveAgentWorkerConfiguration } from './worker-config'

describe('agent worker configuration', () => {
  it('requires the canonical model, billing contract and distributed rate-limit store', () => {
    expect(resolveAgentWorkerConfiguration({})).toMatchObject({
      ok: false,
      missing: ['KATEDRA_AGENT_MODEL', 'KATEDRA_BILLING_RPC_CONTRACT', 'KATEDRA_RATE_LIMIT_STORE'],
    })
  })

  it('rejects legacy billing or non-distributed rate-limit configuration', () => {
    expect(resolveAgentWorkerConfiguration({
      KATEDRA_AGENT_MODEL: 'claude-sonnet-5',
      KATEDRA_BILLING_RPC_CONTRACT: 'legacy',
      KATEDRA_RATE_LIMIT_STORE: 'memory',
    })).toMatchObject({
      ok: false,
      invalid: ['KATEDRA_BILLING_RPC_CONTRACT', 'KATEDRA_RATE_LIMIT_STORE'],
    })
  })

  it('returns the configured model only when all safety contracts are ready', () => {
    expect(resolveAgentWorkerConfiguration({
      KATEDRA_AGENT_MODEL: 'claude-sonnet-5',
      KATEDRA_BILLING_RPC_CONTRACT: 'v2',
      KATEDRA_RATE_LIMIT_STORE: 'supabase',
    })).toEqual({ ok: true, model: 'claude-sonnet-5' })
  })
})
