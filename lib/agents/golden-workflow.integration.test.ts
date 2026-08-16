import { describe, expect, it, vi } from 'vitest'

import type { AgentProvider, CitationEvidence } from './contracts'
import { createProviderBackedExecutor } from './provider-worker'
import type { AgentStepResultPayloadV1 } from './run-result-storage'
import { createAgentRunState, nextRunnableStep, recordStepVerification } from './run-state'
import { verifyAgentResult } from './verifier'
import type { ManuscriptV1 } from '../manuscript/types'

const CHECKED_AT = '2026-08-16T12:00:00.000Z'
const RUN_ID = 'golden-run-1'
const PROJECT_ID = 'golden-project-1'

const manuscript: ManuscriptV1 = {
  schemaVersion: 1,
  projectId: PROJECT_ID,
  title: 'Utjecaj digitalnih platformi na političku participaciju',
  workType: 'z',
  activeSectionId: 'section-1',
  sections: [{
    id: 'section-1',
    title: 'Uvod',
    kind: 'chapter',
    order: 0,
    status: 'draft',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Početni kontekst.' }] }] },
    updatedAt: CHECKED_AT,
  }],
  sources: [],
  meta: { institution: 'FPZG', program: 'Politologija' },
  createdAt: CHECKED_AT,
  updatedAt: CHECKED_AT,
}

function billingDependencies() {
  const rpc = vi.fn(async (name: string) => name === 'katedra_reserve_request'
    ? { data: { status: 'reserved' }, error: null }
    : name === 'katedra_consume'
      ? { data: { status: 'settled' }, error: null }
      : { data: { status: 'released' }, error: null })
  return { db: { rpc }, userId: 'golden-user-1', model: 'golden-model' }
}

function resultPayload(step: ReturnType<typeof nextRunnableStep>, result: Awaited<ReturnType<ReturnType<typeof createProviderBackedExecutor>>>, verification: ReturnType<typeof verifyAgentResult>): AgentStepResultPayloadV1 {
  if (!step || !result.usage) throw new Error('Golden result must contain a step and usage.')
  return {
    schemaVersion: 1,
    kind: 'agent-step-result',
    materialId: `agent-result:${step.id}:${step.attempt}`,
    projectId: PROJECT_ID,
    runId: RUN_ID,
    stepId: step.id,
    agent: step.agent,
    verifier: step.verifier,
    stepOrder: step.order,
    ...(step.sectionId ? { sectionId: step.sectionId } : {}),
    attempt: step.attempt,
    output: String(result.output),
    citations: result.citations,
    ...(result.claims ? { claims: result.claims } : {}),
    verification,
    provider: result.provider,
    usage: result.usage,
    createdAt: CHECKED_AT,
    expiresAt: '2026-08-19T12:00:00.000Z',
  }
}

describe('golden academic workflow', () => {
  it('executes the full verified chain and never skips prior artifacts', async () => {
    const promptByAgent = new Map<string, string>()
    const provider: AgentProvider = {
      id: 'golden-provider',
      capabilities: ['text', 'web_research'],
      async *run(input) {
        const payload = input.payload as { messages?: Array<{ content?: string }> }
        const message = payload.messages?.[0]?.content || '{}'
        const context = JSON.parse(message) as { task?: string }
        const task = context.task || 'unknown'
        promptByAgent.set(task, JSON.stringify(input.payload))
        const citation = { id: 'golden-source', title: 'Provjereni izvor', doi: '10.1234/golden-source', verified: true }
        const claims = ['sources', 'writing', 'citation', 'review'].includes(task)
          ? [{ id: `${task}-claim`, text: `${task} činjenična tvrdnja.`, citationIds: ['golden-source'], support: [{ citationId: 'golden-source', quote: 'Relevantan odlomak izvora.', locator: 'str. 4' }] }]
          : undefined
        yield {
          type: 'completed',
          value: {
            output: JSON.stringify({ output: `${task}-output`, ...(task === 'sources' ? { citations: [citation] } : {}), ...(claims ? { claims } : {}) }),
            usage: { inputTokens: 20, outputTokens: 12 },
          },
        }
      },
    }

    const verifiedCitations = vi.fn(async (citations: CitationEvidence[]) => citations.map((citation) => ({
      ...citation,
      verified: true,
      verification: { status: 'verified' as const, method: 'crossref' as const, checkedAt: CHECKED_AT, evidenceUrl: `https://api.crossref.org/works/${encodeURIComponent(citation.doi || '')}`, titleMatch: true, authorMatch: true, yearMatch: true },
    })))
    const results: AgentStepResultPayloadV1[] = []
    const execute = createProviderBackedExecutor({
      projectId: PROJECT_ID,
      runId: RUN_ID,
      sourcePolicy: 'web_research',
      loadContext: async () => manuscript,
      loadResults: async () => results,
      verifyCitations: verifiedCitations,
      router: { providerFor: (agent, capability) => {
        expect(agent).toBeTruthy()
        if (agent === 'sources') expect(capability).toBe('web_research')
        return provider
      } },
      billing: billingDependencies(),
    })

    let run = createAgentRunState({ runId: RUN_ID, projectId: PROJECT_ID, mode: 'autonomous', sourcePolicy: 'web_research', sectionIds: ['section-1'], now: CHECKED_AT })
    while (true) {
      const step = nextRunnableStep(run)
      if (!step) break
      const result = await execute(step)
      const verification = verifyAgentResult({ ...result, agent: step.agent }, { requireIndependentSourceVerification: ['sources', 'writing', 'citation', 'review'].includes(step.agent) })
      expect(verification.status, `${step.agent} should pass its verifier`).toBe('verified')
      results.push(resultPayload(step, result, verification))
      run = recordStepVerification(run, step.id, verification, CHECKED_AT)
    }

    expect(run.status).toBe('completed')
    expect(results).toHaveLength(8)
    expect(verifiedCitations).toHaveBeenCalled()
    expect(promptByAgent.get('structure')).toContain('intake-output')
    expect(promptByAgent.get('planning')).toContain('sources-output')
    expect(promptByAgent.get('writing')).toContain('planning-output')
    expect(promptByAgent.get('citation')).toContain('writing-output')
    expect(promptByAgent.get('review')).toContain('citation-output')
    expect(promptByAgent.get('export')).toContain('review-output')
  })
})
