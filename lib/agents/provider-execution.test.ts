import { describe, expect, it } from 'vitest'

import type { AgentInput, AgentProvider } from './contracts'
import { executeAgentProvider, RetryableAgentProviderError } from './provider-execution'

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

  it('parses structured claim evidence and adds the source gate instruction', async () => {
    const testProvider: AgentProvider = {
      id: 'anthropic',
      capabilities: ['text'],
      async *run(providerInput) {
        const payload = providerInput.payload as { system?: unknown }
        expect(payload.system).toEqual(expect.stringContaining('claims'))
        yield {
          type: 'completed',
          value: {
            output: JSON.stringify({
              output: 'Argument iz izvora.',
              claims: [{ id: 'claim-1', text: 'Argument iz izvora.', citationIds: ['source-1'] }],
            }),
            usage: { inputTokens: 5, outputTokens: 8 },
          },
        }
      },
    }

    await expect(executeAgentProvider(testProvider, { ...input, payload: { system: 'Postojeća uputa.' } })).resolves.toMatchObject({
      output: 'Argument iz izvora.',
      claims: [{ id: 'claim-1', citationIds: ['source-1'] }],
    })
  })

  it('leaves an unstructured provider response without claims so source agents fail closed', async () => {
    const testProvider: AgentProvider = {
      id: 'anthropic',
      capabilities: ['text'],
      async *run() {
        yield { type: 'completed', value: { output: 'Samo plain text.', usage: { inputTokens: 1, outputTokens: 1 } } }
      },
    }

    await expect(executeAgentProvider(testProvider, input)).resolves.toMatchObject({ output: 'Samo plain text.' })
    await expect(executeAgentProvider(testProvider, input)).resolves.not.toHaveProperty('claims')
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
  it('preserves the retryable signal from transient provider errors', async () => {
    const provider: AgentProvider = {
      id: 'anthropic',
      capabilities: ['text'],
      async *run() { yield { type: 'error', message: 'AI je privremeno nedostupan.', retryable: true } },
    }

    await expect(executeAgentProvider(provider, input)).rejects.toBeInstanceOf(RetryableAgentProviderError)
  })
})
