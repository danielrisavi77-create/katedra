import { describe, expect, it } from 'vitest'

import { evaluateAgenticStagingEnvironment, REQUIRED_AGENTIC_STAGING_ENV } from './agentic-preflight.mjs'

const configured = Object.fromEntries(REQUIRED_AGENTIC_STAGING_ENV.map((key) => [key, 'configured']))
configured.KATEDRA_WORKER_APP_URL = 'https://staging.katedra.example'
configured.KATEDRA_AGENT_MODEL = 'configured-agent-model'
configured.KATEDRA_AGENT_RUNS_ENABLED = 'true'
configured.KATEDRA_PROJECT_LOCKS_ENABLED = 'true'

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

  it('accepts complete staging worker configuration', () => {
    expect(evaluateAgenticStagingEnvironment(configured)).toEqual({ ok: true, missing: [], invalid: [] })
  })
})
