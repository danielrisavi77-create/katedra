import { describe, expect, it, vi } from 'vitest'

import type { AgentProvider } from './contracts'
import { createProviderBackedExecutor } from './provider-worker'
import { runAgentWorkerLoop } from './worker-loop'
import { verifyAgentResult } from './verifier'

describe('agentic runtime integration', () => {
  it('runs one claimed step through provider, verifier, billing and completion', async () => {
    let claimed = true
    const rpc = vi.fn(async (name: string) => {
      if (name === 'claim_agent_step' && claimed) {
        claimed = false
        return { data: { step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', section_id: 'section-1', step_order: 1, attempt: 1, status: 'pending' }, error: null }
      }
      if (name === 'claim_agent_step') return { data: null, error: null }
      if (name === 'katedra_reserve_request') return { data: { status: 'reserved' }, error: null }
      if (name === 'katedra_consume') return { data: { status: 'settled' }, error: null }
      if (name === 'katedra_release_request') return { data: { status: 'released' }, error: null }
      if (name === 'complete_agent_step') return { data: { status: 'verified' }, error: null }
      return { data: null, error: null }
    })
    const provider: AgentProvider = {
      id: 'fake-provider',
      capabilities: ['text'],
      async *run() {
        yield {
          type: 'completed',
          value: {
            output: JSON.stringify({
              output: 'Argumentirani odlomak.',
              claims: [{ id: 'claim-1', text: 'Argumentirani odlomak.', citationIds: ['source-1'] }],
            }),
            usage: { inputTokens: 12, outputTokens: 9 },
          },
        }
      },
    }
    const manuscript = {
      schemaVersion: 1 as const,
      projectId: 'project-1',
      title: 'Rad',
      workType: 's' as const,
      activeSectionId: 'section-1',
      sections: [{ id: 'section-1', title: 'Uvod', kind: 'chapter' as const, order: 0, status: 'draft' as const, content: { type: 'doc' as const, content: [{ type: 'paragraph' as const }] }, updatedAt: '2026-08-14T10:00:00.000Z' }],
      sources: [{ id: 'source-1', title: 'Provjereni izvor', urlOrDoi: 'https://example.com', verified: true }],
      meta: {},
      createdAt: '2026-08-14T10:00:00.000Z',
      updatedAt: '2026-08-14T10:00:00.000Z',
    }
    const execute = createProviderBackedExecutor({
      projectId: 'project-1',
      runId: 'run-1',
      sourcePolicy: 'uploaded_only',
      loadContext: async () => manuscript,
      router: { providerFor: () => provider },
      billing: { db: { rpc }, userId: 'user-1', model: 'agent-model' },
    })

    const result = await runAgentWorkerLoop(
      { db: { rpc }, workerId: 'worker-1', runId: 'run-1' },
      { execute, verify: verifyAgentResult },
      { maxSteps: 1 },
    )

    expect(result).toMatchObject({ status: 'limit', stepsProcessed: 1, lastStepId: 'step-1' })
    expect(rpc).toHaveBeenCalledWith('katedra_consume', expect.objectContaining({ p_request_id: 'run-1:step-1:1' }))
    expect(rpc).toHaveBeenCalledWith('complete_agent_step', expect.objectContaining({ p_status: 'verified', p_worker_id: 'worker-1' }))
  })
})
