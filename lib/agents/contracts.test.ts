import { describe, expect, it } from 'vitest'

import type { AgentId, AgentProvider } from './contracts'
import { createAgentContract, isAgentId } from './contracts'

describe('agent contracts', () => {
  it('recognizes the supported agent roles', () => {
    expect(isAgentId('intake')).toBe(true)
    expect(isAgentId('writing')).toBe(true)
    expect(isAgentId('unknown')).toBe(false)
  })

  it('creates a result envelope with verifier-ready metadata', () => {
    const provider: AgentProvider = {
      id: 'test-provider',
      capabilities: ['text'],
      async *run() {},
    }
    const contract = createAgentContract('writing', provider)

    expect(contract).toMatchObject({
      agent: 'writing' satisfies AgentId,
      verifier: 'writing_verifier',
      provider: 'test-provider',
      maxAttempts: 3,
    })
  })
})
