import { describe, expect, it } from 'vitest'

import { createAgentRunState, nextRunnableStep, recordStepVerification } from './run-state'

describe('agent run state', () => {
  it('creates a sequential pipeline with one writing step per section', () => {
    const run = createAgentRunState({ runId: 'run-1', projectId: 'project-1', mode: 'autonomous', sourcePolicy: 'web_research', sectionIds: ['intro', 'analysis'] })

    expect(run.steps.map((step) => step.agent)).toEqual([
      'intake', 'sources', 'structure', 'planning', 'writing', 'writing', 'citation', 'review', 'export',
    ])
    expect(run.steps[4].sectionId).toBe('intro')
    expect(run.status).toBe('pending')
  })

  it('only exposes the first pending step until its verifier passes', () => {
    const run = createAgentRunState({ runId: 'run-1', projectId: 'project-1', mode: 'guided', sourcePolicy: 'uploaded_only', sectionIds: ['intro'] })
    expect(nextRunnableStep(run)?.agent).toBe('intake')

    const next = recordStepVerification(run, run.steps[0].id, { status: 'verified', issues: [], evidence: [] })
    expect(nextRunnableStep(next)?.agent).toBe('sources')
  })

  it('blocks a step after the third rejected attempt', () => {
    const initial = createAgentRunState({ runId: 'run-1', projectId: 'project-1', mode: 'autonomous', sourcePolicy: 'uploaded_only', sectionIds: ['intro'] })
    const first = recordStepVerification(initial, initial.steps[0].id, { status: 'needs_revision', issues: [], evidence: [] })
    const second = recordStepVerification(first, first.steps[0].id, { status: 'needs_revision', issues: [], evidence: [] })
    const third = recordStepVerification(second, second.steps[0].id, { status: 'needs_revision', issues: [], evidence: [] })

    expect(third.steps[0]).toMatchObject({ status: 'blocked', attempt: 3 })
    expect(third.status).toBe('blocked')
    expect(nextRunnableStep(third)).toBeNull()
  })
})
