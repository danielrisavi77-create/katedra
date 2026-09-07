import type { AgentResultV1, VerificationResultV1 } from './contracts'
import { processClaimedAgentStep, type AgentWorkerDependencies, type WorkerStepStatus } from './worker'
import type { AgentStepRecord } from './run-state'

export const DEFAULT_WORKER_LOOP_MAX_STEPS = 10

export type WorkerLoopStopStatus = WorkerStepStatus | 'limit'

export interface AgentWorkerLoopHandlers {
  execute: (step: AgentStepRecord) => Promise<Omit<AgentResultV1, 'agent'>>
  verify: (result: AgentResultV1, context: { step: AgentStepRecord }) => VerificationResultV1 | Promise<VerificationResultV1>
}

export interface AgentWorkerLoopOptions {
  maxSteps?: number
}

export interface AgentWorkerLoopResult {
  status: WorkerLoopStopStatus
  stepsProcessed: number
  lastStepId?: string
  error?: string
}

/**
 * Runs claimed steps serially. A retry is returned to the scheduler so a later
 * invocation can reclaim it after the backend has requeued it.
 */
export async function runAgentWorkerLoop(
  dependencies: AgentWorkerDependencies,
  handlers: AgentWorkerLoopHandlers,
  options: AgentWorkerLoopOptions = {},
): Promise<AgentWorkerLoopResult> {
  const maxSteps = normalizeMaxSteps(options.maxSteps ?? DEFAULT_WORKER_LOOP_MAX_STEPS)
  let stepsProcessed = 0
  let lastStepId: string | undefined

  while (stepsProcessed < maxSteps) {
    const result = await processClaimedAgentStep(dependencies, handlers)
    if (result.stepId) lastStepId = result.stepId
    if (result.stepId) stepsProcessed += 1

    if (result.status !== 'verified') {
      return { status: result.status, stepsProcessed, lastStepId, error: result.error }
    }

    if (stepsProcessed >= maxSteps) {
      return { status: 'limit', stepsProcessed, lastStepId }
    }
  }

  return { status: 'limit', stepsProcessed, lastStepId }
}

function normalizeMaxSteps(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_WORKER_LOOP_MAX_STEPS
  return Math.max(0, Math.trunc(value))
}
