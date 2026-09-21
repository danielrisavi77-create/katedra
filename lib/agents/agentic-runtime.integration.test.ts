import { describe, expect, it, vi } from 'vitest'

import type { AgentProvider } from './contracts'
import { executionContextFixture, executionRecoveryFixture } from './execution-recovery.fixture'
import { createProviderBackedExecutor } from './provider-worker'
import { runAgentWorkerLoop } from './worker-loop'
import { verifyAgentResult } from './verifier'

describe('agentic runtime integration', () => {
  it('runs one claimed step through provider, verifier, billing and completion', async () => {
    const fixture = executionRecoveryFixture()
    let claimed = true
    const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
      if (name === 'claim_agent_step' && claimed) {
        claimed = false
        return { data: { step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', section_id: 'section-1', step_order: 1, attempt: 1, status: 'running', lease_owner: 'worker-1', claimed_at: executionContextFixture.stepClaimedAt }, error: null }
      }
      if (name === 'claim_agent_step') return { data: null, error: null }
      if (name === 'complete_agent_step') return { data: { status: 'verified' }, error: null }
      return fixture.rpc(name, params)
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
      sources: [{ id: 'source-1', title: 'Provjereni izvor', urlOrDoi: '10.1234/example', verified: true }],
      meta: {},
      createdAt: '2026-08-14T10:00:00.000Z',
      updatedAt: '2026-08-14T10:00:00.000Z',
    }
    const execute = createProviderBackedExecutor({
      contextRevision: executionContextFixture.contextRevision,
      projectId: 'project-1',
      runId: 'run-1',
      sourcePolicy: 'uploaded_only',
      loadContext: async () => manuscript,
      verifyCitations: async (citations) => citations.map((citation) => ({
        ...citation,
        verified: true,
        verification: { status: 'verified', method: 'crossref', checkedAt: '2026-08-16T12:00:00.000Z' },
      })),
      router: { providerFor: () => provider },
      billing: { db: { ...fixture.db, rpc }, userId: 'user-1', model: 'agent-model' },
    })

    const result = await runAgentWorkerLoop(
      { db: { rpc }, workerId: 'worker-1', runId: 'run-1' },
      { execute, verify: (agentResult) => verifyAgentResult(agentResult, { requireIndependentSourceVerification: false }) },
      { maxSteps: 1 },
    )

    expect(result).toMatchObject({ status: 'limit', stepsProcessed: 1, lastStepId: 'step-1' })
    expect(rpc).toHaveBeenCalledWith('claim_agent_provider_execution', expect.objectContaining({ p_identity: expect.objectContaining({ requestId: 'run-1:step-1:1' }) }))
    expect(rpc).toHaveBeenCalledWith('start_agent_provider_execution', expect.objectContaining({ p_worker_id: 'worker-1', p_step_claimed_at: executionContextFixture.stepClaimedAt }))
    expect(fixture.debitCount()).toBe(1)
    expect(rpc).toHaveBeenCalledWith('complete_agent_step', expect.objectContaining({ p_status: 'verified', p_worker_id: 'worker-1' }))
  })
})
