import { describe, expect, it } from 'vitest'

import { inspectAgenticContract } from './contract-preflight'

describe('agentic contract preflight', () => {
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
})
