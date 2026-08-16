import { describe, expect, it } from 'vitest'

import { isAgenticWorkspaceAvailable, isAgentWebResearchAvailable } from './agentic-availability'

const completeEnvironment = {
  KATEDRA_AGENT_RUNS_ENABLED: 'true',
  KATEDRA_PROJECT_LOCKS_ENABLED: 'true',
  KATEDRA_MATERIALS_ENABLED: 'true',
  KATEDRA_MATERIAL_DELETE_RPC_CONTRACT: 'v1',
  KATEDRA_AGENT_MODEL: 'claude-sonnet-4-5',
  KATEDRA_BILLING_RPC_CONTRACT: 'v2',
  KATEDRA_RATE_LIMIT_STORE: 'supabase',
  KATEDRA_WORKER_APP_URL: 'https://worker.example.test',
  KATEDRA_AGENT_WORKER_TOKEN: 'worker-token',
  KATEDRA_AGENT_WORKER_CRON_SECRET: 'cron-secret',
  ANTHROPIC_API_KEY: 'sk-test',
}

describe('agentic workspace availability', () => {
  it('requires the complete server-side workflow, not only feature flags', () => {
    expect(isAgenticWorkspaceAvailable(completeEnvironment)).toBe(true)
    expect(isAgenticWorkspaceAvailable({ ...completeEnvironment, KATEDRA_WORKER_APP_URL: 'http://localhost:3000' })).toBe(false)
    expect(isAgenticWorkspaceAvailable({ ...completeEnvironment, KATEDRA_AGENT_WORKER_TOKEN: '' })).toBe(false)
    expect(isAgenticWorkspaceAvailable({ ...completeEnvironment, KATEDRA_MATERIALS_ENABLED: 'false' })).toBe(false)
  })

  it('does not advertise the workspace before canonical material deletion is ready', () => {
    expect(isAgenticWorkspaceAvailable({
      ...completeEnvironment,
      KATEDRA_MATERIAL_DELETE_RPC_CONTRACT: '',
    })).toBe(false)
    expect(isAgenticWorkspaceAvailable({
      ...completeEnvironment,
      KATEDRA_MATERIAL_DELETE_RPC_CONTRACT: 'legacy',
    })).toBe(false)
  })

  it('keeps web research unavailable until its policy and provider adapters exist', () => {
    expect(isAgentWebResearchAvailable(completeEnvironment)).toBe(false)
  })
})
