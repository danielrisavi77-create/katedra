import { describe, expect, it } from 'vitest'

import { evaluateProductionEnvironment, REQUIRED_PRODUCTION_ENV } from './preflight.mjs'

const configured = Object.fromEntries(REQUIRED_PRODUCTION_ENV.map((key) => [key, 'configured']))
configured.NEXT_PUBLIC_APP_URL = 'https://katedra.example'
configured.WITHDRAWAL_FROM_EMAIL = 'support@katedra.example'
configured.KATEDRA_BILLING_RPC_CONTRACT = 'v2'
configured.KATEDRA_RATE_LIMIT_STORE = 'supabase'
configured.KATEDRA_PROJECT_LOCKS_ENABLED = 'true'

describe('evaluateProductionEnvironment', () => {
  it('accepts a complete production environment without exposing values', () => {
    expect(evaluateProductionEnvironment(configured)).toEqual({ ok: true, missing: [], invalid: [] })
  })

  it('reports only missing variable names', () => {
    const result = evaluateProductionEnvironment({})
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('ANTHROPIC_API_KEY')
    expect(JSON.stringify(result)).not.toContain('configured')
  })

  it('rejects unsafe sender, URL and release-contract values', () => {
    const result = evaluateProductionEnvironment({
      ...configured,
      NEXT_PUBLIC_APP_URL: 'http://katedra.example',
      WITHDRAWAL_FROM_EMAIL: 'onboarding@resend.dev',
      KATEDRA_BILLING_RPC_CONTRACT: 'legacy',
      KATEDRA_RATE_LIMIT_STORE: 'redis',
    })
    expect(result).toMatchObject({ ok: false, missing: [], invalid: expect.arrayContaining([
      'NEXT_PUBLIC_APP_URL',
      'WITHDRAWAL_FROM_EMAIL',
      'KATEDRA_BILLING_RPC_CONTRACT',
      'KATEDRA_RATE_LIMIT_STORE',
    ]) })
  })
  it('rejects a paid production environment without server-side project locks', () => {
    const result = evaluateProductionEnvironment({
      ...configured,
      KATEDRA_PROJECT_LOCKS_ENABLED: 'false',
    })

    expect(result.ok).toBe(false)
    expect(result.invalid).toContain('KATEDRA_PROJECT_LOCKS_ENABLED')
  })
  it('fails closed when agent runs are enabled without project locks and worker token', () => {
    const result = evaluateProductionEnvironment({
      ...configured,
      KATEDRA_AGENT_RUNS_ENABLED: 'true',
      KATEDRA_PROJECT_LOCKS_ENABLED: 'false',
    })

    expect(result.ok).toBe(false)
    expect(result.missing).toContain('KATEDRA_AGENT_WORKER_TOKEN')
    expect(result.missing).toContain('KATEDRA_AGENT_MODEL')
    expect(result.invalid).toContain('KATEDRA_PROJECT_LOCKS_ENABLED')
  })

  it('accepts enabled agent runs only with the lock contract and worker token', () => {
    const result = evaluateProductionEnvironment({
      ...configured,
      KATEDRA_AGENT_RUNS_ENABLED: 'true',
      KATEDRA_PROJECT_LOCKS_ENABLED: 'true',
      KATEDRA_AGENT_WORKER_TOKEN: 'staging-worker-token',
      KATEDRA_AGENT_MODEL: 'configured-agent-model',
    })

    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(expect.arrayContaining([
      'KATEDRA_WORKER_APP_URL',
      'KATEDRA_AGENT_WORKER_CRON_SECRET',
    ]))
  })

  it('accepts enabled agent runs only with the dispatcher and cron contract', () => {
    const result = evaluateProductionEnvironment({
      ...configured,
      KATEDRA_AGENT_RUNS_ENABLED: 'true',
      KATEDRA_PROJECT_LOCKS_ENABLED: 'true',
      KATEDRA_AGENT_WORKER_TOKEN: 'staging-worker-token',
      KATEDRA_AGENT_MODEL: 'configured-agent-model',
      KATEDRA_WORKER_APP_URL: 'https://worker.katedra.example',
      KATEDRA_AGENT_WORKER_CRON_SECRET: 'staging-cron-secret',
    })

    expect(result).toEqual({ ok: true, missing: [], invalid: [] })
  })

  it('requires the canonical material deletion contract when material uploads are enabled', () => {
    const result = evaluateProductionEnvironment({
      ...configured,
      KATEDRA_MATERIALS_ENABLED: 'true',
    })

    expect(result.ok).toBe(false)
    expect(result.missing).toContain('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT')
  })
})
