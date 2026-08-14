import { describe, expect, it } from 'vitest'

import type { AgentInput, AgentProvider } from './contracts'
import { executeAgentProvider } from './provider-execution'

const input: AgentInput = { projectId: 'project-1', runId: 'run-1', payload: {}, attempt: 1 }

describe('provider execution bridge', () => {
  it('collects deltas and completed usage into a worker result', async () => {
    const testProvider: AgentProvider = {
      id: 'anthropic',
      capabilities: ['text'],
      async *run() {
        yield { type: 'delta', value: 'Prvi ' }
        yield { type: 'delta', value: 'odlomak' }
        yield { type: 'completed', value: { output: 'Prvi odlomak', usage: { inputTokens: 4, outputTokens: 2 } } }
      },
    }

    await expect(executeAgentProvider(testProvider, input)).resolves.toEqual({
      output: 'Prvi odlomak',
      citations: [],
      provider: 'anthropic',
      usage: { inputTokens: 4, outputTokens: 2 },
    })
  })

  it('fails closed when provider emits an error or never completes', async () => {
    const errorProvider: AgentProvider = {
      id: 'anthropic',
      capabilities: ['text'],
      async *run() { yield { type: 'error', message: 'AI nije dostupan.' } },
    }
    const incompleteProvider: AgentProvider = {
      id: 'anthropic',
      capabilities: ['text'],
      async *run() { yield { type: 'delta', value: 'nedovršeno' } },
    }

    await expect(executeAgentProvider(errorProvider, input)).rejects.toThrow('AI nije dostupan.')
    await expect(executeAgentProvider(incompleteProvider, input)).rejects.toThrow(/nije završio/i)
  })
})
