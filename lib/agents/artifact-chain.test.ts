import { describe, expect, it } from 'vitest'

import type { AgentStepResultPayloadV1 } from './run-result-storage'
import { selectVerifiedAgentArtifacts } from './artifact-chain'

function result(overrides: Partial<AgentStepResultPayloadV1>): AgentStepResultPayloadV1 {
  return {
    schemaVersion: 1,
    kind: 'agent-step-result',
    materialId: 'agent-result:default:1',
    projectId: 'project-1',
    runId: 'run-1',
    stepId: 'step-default',
    stepOrder: 0,
    agent: 'intake',
    verifier: 'intake_verifier',
    attempt: 1,
    output: 'Rezultat',
    citations: [],
    verification: { status: 'verified', issues: [], evidence: [] },
    provider: 'provider-a',
    usage: { inputTokens: 1, outputTokens: 1 },
    createdAt: '2026-08-16T10:00:00.000Z',
    expiresAt: '2026-08-19T10:00:00.000Z',
    ...overrides,
  }
}

describe('verified agent artifact chain', () => {
  it('passes only the latest verified artifacts from earlier steps', () => {
    const artifacts = selectVerifiedAgentArtifacts([
      result({ materialId: 'agent-result:intake:1', stepId: 'intake-step', stepOrder: 0, attempt: 1, output: 'Stara verzija' }),
      result({ materialId: 'agent-result:intake:2', stepId: 'intake-step', stepOrder: 0, attempt: 2, output: 'Nova verzija', createdAt: '2026-08-16T10:01:00.000Z' }),
      result({ materialId: 'agent-result:sources:1', stepId: 'sources-step', stepOrder: 1, agent: 'sources', verifier: 'sources_verifier', verification: { status: 'needs_revision', issues: [], evidence: [] } }),
      result({ materialId: 'agent-result:future:1', stepId: 'future-step', stepOrder: 4, output: 'Ne smije procuriti' }),
    ], { order: 2 })

    expect(artifacts).toEqual([
      expect.objectContaining({ stepId: 'intake-step', attempt: 2, output: 'Nova verzija' }),
    ])
  })

  it('bounds previous agent output before it enters a new provider context', () => {
    const artifacts = selectVerifiedAgentArtifacts([
      result({ output: 'x'.repeat(200_000) }),
    ], { order: 2 })

    expect(artifacts[0].output).toHaveLength(120_000)
  })

  it('rejects artifacts from another run or project even when the caller passes mixed results', () => {
    const artifacts = selectVerifiedAgentArtifacts([
      result({ materialId: 'agent-result:other:1', projectId: 'other-project', runId: 'other-run', output: 'Ne smije ući' }),
      result({ materialId: 'agent-result:valid:1', stepId: 'valid-step', output: 'Smije ući' }),
    ], { order: 2, projectId: 'project-1', runId: 'run-1' })

    expect(artifacts).toEqual([expect.objectContaining({ stepId: 'valid-step', output: 'Smije ući' })])
  })

  it('passes only the declared upstream agents to a later agent', () => {
    const artifacts = selectVerifiedAgentArtifacts([
      result({ materialId: 'agent-result:intake:1', stepId: 'intake-step', stepOrder: 0, agent: 'intake', output: 'Ulazni sažetak' }),
      result({ materialId: 'agent-result:sources:1', stepId: 'sources-step', stepOrder: 1, agent: 'sources', verifier: 'sources_verifier', output: 'Verificirani izvori' }),
      result({ materialId: 'agent-result:structure:1', stepId: 'structure-step', stepOrder: 2, agent: 'structure', verifier: 'structure_verifier', output: 'Verificirana struktura' }),
      result({ materialId: 'agent-result:planning:1', stepId: 'planning-step', stepOrder: 3, agent: 'planning', verifier: 'planning_verifier', output: 'Verificirani plan' }),
    ], { order: 4, agent: 'writing' })

    expect(artifacts.map((artifact) => artifact.agent)).toEqual(['sources', 'structure', 'planning'])
    expect(artifacts.map((artifact) => artifact.output)).not.toContain('Ulazni sažetak')
  })
})
