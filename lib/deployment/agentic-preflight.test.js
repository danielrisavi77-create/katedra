import { describe, expect, it } from 'vitest'

import { evaluateAgenticStagingEnvironment, REQUIRED_AGENTIC_STAGING_ENV } from './agentic-preflight.mjs'

const configured = Object.fromEntries(REQUIRED_AGENTIC_STAGING_ENV.map((key) => [key, 'configured']))
configured.KATEDRA_WORKER_APP_URL = 'https://staging.katedra.example'
configured.KATEDRA_AGENT_MODEL = 'configured-agent-model'
configured.KATEDRA_AGENT_RUNS_ENABLED = 'true'
configured.KATEDRA_PROJECT_LOCKS_ENABLED = 'true'
configured.KATEDRA_BILLING_RPC_CONTRACT = 'v2'
configured.KATEDRA_RATE_LIMIT_STORE = 'supabase'
configured.KATEDRA_VERIFIER_PROVIDER_URL = 'https://verifier.katedra.example/run'
configured.KATEDRA_VERIFIER_PROVIDER_KEY = 'configured-verifier-key'
configured.KATEDRA_VERIFIER_PROVIDER_MODEL = 'configured-verifier-model'
configured.KATEDRA_VERIFIER_POLICY_APPROVED = 'true'

describe('evaluateAgenticStagingEnvironment', () => {
  it('reports missing agentic worker configuration without exposing secret values', () => {
    const result = evaluateAgenticStagingEnvironment({})

    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(expect.arrayContaining(REQUIRED_AGENTIC_STAGING_ENV))
    expect(JSON.stringify(result)).not.toContain('configured')
  })

  it('rejects non-HTTPS worker endpoints', () => {
    const result = evaluateAgenticStagingEnvironment({
      ...configured,
      KATEDRA_WORKER_APP_URL: 'http://staging.katedra.example',
    })

    expect(result).toEqual({ ok: false, missing: [], invalid: ['KATEDRA_WORKER_APP_URL'] })
  })

  it('rejects a worker configuration when agentic feature flags are not enabled', () => {
    const result = evaluateAgenticStagingEnvironment({
      ...configured,
      KATEDRA_AGENT_RUNS_ENABLED: 'false',
    })

    expect(result.ok).toBe(false)
    expect(result.invalid).toContain('KATEDRA_AGENT_RUNS_ENABLED')
  })

  it.each([
    ['missing', 'KATEDRA_BILLING_RPC_CONTRACT', undefined, 'missing'],
    ['invalid', 'KATEDRA_BILLING_RPC_CONTRACT', 'v1', 'invalid'],
    ['missing', 'KATEDRA_RATE_LIMIT_STORE', undefined, 'missing'],
    ['invalid', 'KATEDRA_RATE_LIMIT_STORE', 'memory', 'invalid'],
  ])('rejects %s worker %s configuration', (kind, key, value, resultKey) => {
    const result = evaluateAgenticStagingEnvironment({ ...configured, [key]: value })
    const oppositeResultKey = resultKey === 'missing' ? 'invalid' : 'missing'

    expect(result.ok).toBe(false)
    expect(result[resultKey]).toContain(key)
    expect(result[oppositeResultKey]).not.toContain(key)
  })

  it('accepts complete staging worker configuration', () => {
    expect(evaluateAgenticStagingEnvironment(configured)).toEqual({ ok: true, missing: [], invalid: [] })
  })

  it('requires the canonical material deletion contract when material uploads are enabled', () => {
    const result = evaluateAgenticStagingEnvironment({
      ...configured,
      KATEDRA_MATERIALS_ENABLED: 'true',
    })

    expect(result.ok).toBe(false)
    expect(result.missing).toContain('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT')
  })
})
