import type { AgentResultV1, VerificationResultV1 } from './contracts'
import { nextRunnableStep, recordStepVerification, type AgentRunState } from './run-state'

export interface OrchestratorDependencies {
  execute(input: { agent: AgentRunState['steps'][number]['agent']; sectionId?: string; attempt: number; runId: string; projectId: string }): Promise<Omit<AgentResultV1, 'agent'>>
  verify(result: AgentResultV1): VerificationResultV1
}

export function createOrchestrator(dependencies: OrchestratorDependencies) {
  return {
    async advance(run: AgentRunState): Promise<AgentRunState> {
      const step = nextRunnableStep(run)
      if (!step) return run
      const result = await dependencies.execute({
        agent: step.agent,
        sectionId: step.sectionId,
        attempt: step.attempt,
        runId: run.runId,
        projectId: run.projectId,
      })
      const verification = dependencies.verify({ ...result, agent: step.agent })
      return recordStepVerification({ ...run, status: 'running' }, step.id, verification)
    },
  }
}
