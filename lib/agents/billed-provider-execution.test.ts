import { describe, expect, it, vi } from 'vitest'

import type { AgentProvider } from './contracts'
import { executeBilledAgentProvider } from './billed-provider-execution'

function providerWithEvents(events: Array<{ type: 'completed' | 'error'; value?: unknown; message?: string }>): AgentProvider {
  return {
    id: 'fake-provider',
    capabilities: ['text'],
    async *run() {
      for (const event of events) yield event as never
    },
  }
}

describe('billed provider execution', () => {
  it('reserves, settles exactly once, and releases the distributed reservation', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'katedra_reserve_request') return { data: { status: 'reserved' }, error: null }
      if (name === 'katedra_consume') return { data: { status: 'settled' }, error: null }
      if (name === 'katedra_release_request') return { data: { status: 'released' }, error: null }
      return { data: null, error: null }
    })
    const result = await executeBilledAgentProvider({ rpc }, {
      provider: providerWithEvents([{ type: 'completed', value: { output: 'tekst', usage: { inputTokens: 10, outputTokens: 20 } } }]),
      agentInput: { projectId: 'project-1', runId: 'run-1', payload: { messages: [] }, attempt: 1 },
      userId: 'user-1', projectId: 'project-1', requestId: 'run-1:step-1:1', model: 'agent-model',
    })

    expect(result).toMatchObject({ output: 'tekst', provider: 'fake-provider', usage: { inputTokens: 10, outputTokens: 20 } })
    expect(rpc).toHaveBeenNthCalledWith(1, 'katedra_reserve_request', expect.objectContaining({ p_request_id: 'run-1:step-1:1' }))
    expect(rpc).toHaveBeenCalledWith('katedra_consume', expect.objectContaining({ p_request_id: 'run-1:step-1:1', p_project_id: 'project-1', p_in: 10, p_out: 20 }))
    expect(rpc).toHaveBeenCalledWith('katedra_release_request', { p_user: 'user-1', p_request_id: 'run-1:step-1:1' })
  })

  it('releases without consuming when the provider fails', async () => {
    const rpc = vi.fn(async (name: string) => name === 'katedra_reserve_request'
      ? { data: { status: 'reserved' }, error: null }
      : { data: { status: 'released' }, error: null })

    await expect(executeBilledAgentProvider({ rpc }, {
      provider: providerWithEvents([{ type: 'error', message: 'provider down' }]),
      agentInput: { projectId: 'project-1', payload: {}, attempt: 1 },
      userId: 'user-1', projectId: 'project-1', requestId: 'request-2', model: 'agent-model',
    })).rejects.toThrow('provider down')
    expect(rpc).toHaveBeenCalledWith('katedra_release_request', { p_user: 'user-1', p_request_id: 'request-2' })
    expect(rpc).not.toHaveBeenCalledWith('katedra_consume', expect.anything())
  })

  it('fails closed and releases when provider usage is unavailable', async () => {
    const rpc = vi.fn(async (name: string) => name === 'katedra_reserve_request'
      ? { data: { status: 'reserved' }, error: null }
      : { data: { status: 'released' }, error: null })

    await expect(executeBilledAgentProvider({ rpc }, {
      provider: providerWithEvents([{ type: 'completed', value: { output: 'tekst', usage: { inputTokens: 0, outputTokens: 0 } } }]),
      agentInput: { projectId: 'project-1', payload: {}, attempt: 1 },
      userId: 'user-1', projectId: 'project-1', requestId: 'request-3', model: 'agent-model',
    })).rejects.toThrow('usage')
    expect(rpc).not.toHaveBeenCalledWith('katedra_consume', expect.anything())
  })
})
