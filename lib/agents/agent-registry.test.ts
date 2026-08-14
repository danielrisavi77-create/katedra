import { describe, expect, it } from 'vitest'

import { createAgentRegistry } from './agent-registry'
import type { AgentProvider } from './contracts'

const provider: AgentProvider = { id: 'default', capabilities: ['text', 'web_research', 'vision'], async *run() {} }

describe('agent registry', () => {
  it('creates a verifier-backed contract for every supported agent', () => {
    const registry = createAgentRegistry({ providerFor: () => provider })

    expect(registry.contracts()).toHaveLength(8)
    expect(registry.contracts().every((contract) => contract.verifier.endsWith('_verifier'))).toBe(true)
  })
})
