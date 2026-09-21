import { describe, expect, it } from 'vitest'

import type { AgentProvider } from './contracts'
import { ProviderCapabilityError, createProviderRouter } from './provider-router'

function provider(id: string, capabilities: AgentProvider['capabilities']): AgentProvider {
  return { id, capabilities, async *run() {} }
}

describe('provider router', () => {
  it('selects the configured provider for an agent and capability', () => {
    const router = createProviderRouter({
      providers: [provider('writer', ['text']), provider('researcher', ['text', 'web_research'])],
      assignments: { writing: 'writer', sources: 'researcher' },
    })

    expect(router.providerFor('writing', 'text').id).toBe('writer')
    expect(router.providerFor('sources', 'web_research').id).toBe('researcher')
  })

  it('fails closed when the configured provider lacks a capability', () => {
    const router = createProviderRouter({
      providers: [provider('writer', ['text'])],
      assignments: { writing: 'writer' },
    })

    expect(() => router.providerFor('writing', 'web_research')).toThrow(ProviderCapabilityError)
  })
})
