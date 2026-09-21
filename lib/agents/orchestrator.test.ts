import { describe, expect, it, vi } from 'vitest'

import { createOrchestrator } from './orchestrator'
import { createAgentRunState } from './run-state'

describe('agent orchestrator', () => {
  it('executes the next step and records one verification result', async () => {
    const run = createAgentRunState({ runId: 'run-1', projectId: 'project-1', mode: 'autonomous', sourcePolicy: 'uploaded_only', sectionIds: ['intro'] })
    const execute = vi.fn().mockResolvedValue({ output: 'brief', citations: [] })
    const verify = vi.fn().mockReturnValue({ status: 'verified', issues: [], evidence: [] })
    const orchestrator = createOrchestrator({ execute, verify })

    const next = await orchestrator.advance(run)

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ agent: 'intake', attempt: 1 }))
    expect(verify).toHaveBeenCalledOnce()
    expect(next.steps[0].status).toBe('verified')
  })
})
