import { describe, expect, it } from 'vitest'

import { inspectAgenticContract, REQUIRED_AGENTIC_FUNCTIONS, REQUIRED_AGENTIC_TABLES } from './contract-preflight'

describe('agentic contract preflight', () => {
  it('blocks activation without atomic consent withdrawal', async () => {
    const result = await inspectAgenticContract({ hasTable: async () => true, hasFunction: async name => name !== 'revoke_agent_run_consent' })
    expect(result).toEqual({ ready: false, missingTables: [], missingFunctions: ['revoke_agent_run_consent'] })
  })
  it('requires canonical material tombstone and active-list RPCs', () => {
    expect(REQUIRED_AGENTIC_FUNCTIONS).toEqual(expect.arrayContaining([
      'tombstone_agent_payload',
      'list_active_agent_payloads',
      'replace_agent_payloads_for_run',
      'katedra_reserve_request',
      'katedra_release_request',
      'katedra_consume',
      'katedra_mark_pending',
    ]))
    expect(REQUIRED_AGENTIC_TABLES).toEqual(expect.arrayContaining([
      'katedra_request_reservations',
      'katedra_billing_attempts',
      'katedra_wallets',
      'katedra_usage',
    ]))
  })

  it('reports ready only when every canonical table and RPC exists', async () => {
    const result = await inspectAgenticContract({
      hasTable: async () => true,
      hasFunction: async () => true,
    })
    expect(result).toEqual({ ready: true, missingTables: [], missingFunctions: [] })
  })

  it('fails closed with the exact missing contract pieces', async () => {
    const result = await inspectAgenticContract({
      hasTable: async (name) => name !== 'agent_steps',
      hasFunction: async (name) => name !== 'complete_agent_step',
    })
    expect(result.ready).toBe(false)
    expect(result.missingTables).toEqual(['agent_steps'])
    expect(result.missingFunctions).toEqual(['complete_agent_step'])
  })

  it('does not report a ready contract when billing functions or tables are missing', async () => {
    const result = await inspectAgenticContract({
      hasTable: async (name) => name !== 'katedra_billing_attempts',
      hasFunction: async (name) => name !== 'katedra_mark_pending',
    })

    expect(result.ready).toBe(false)
    expect(result.missingTables).toEqual(['katedra_billing_attempts'])
    expect(result.missingFunctions).toEqual(['katedra_mark_pending'])
  })
})
