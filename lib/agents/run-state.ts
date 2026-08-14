import type { AgentId, AgentResultV1, VerificationResultV1 } from './contracts'

export type AgentRunMode = 'guided' | 'accelerated' | 'autonomous'
export type SourcePolicy = 'uploaded_only' | 'uploaded_plus_suggestions' | 'web_research'
export type AgentRunStatus = 'pending' | 'running' | 'paused' | 'blocked' | 'failed' | 'completed'
export type AgentStepStatus = 'pending' | 'running' | 'retrying' | 'verified' | 'blocked' | 'failed'

export interface AgentStepRecord {
  id: string
  agent: AgentId
  verifier: `${AgentId}_verifier`
  sectionId?: string
  order: number
  attempt: 1 | 2 | 3
  status: AgentStepStatus
  lastVerification?: VerificationResultV1
}

export interface AgentRunState {
  runId: string
  projectId: string
  mode: AgentRunMode
  sourcePolicy: SourcePolicy
  status: AgentRunStatus
  steps: AgentStepRecord[]
  updatedAt: string
}

export function createAgentRunState(input: {
  runId: string
  projectId: string
  mode: AgentRunMode
  sourcePolicy: SourcePolicy
  sectionIds: string[]
  now?: string
}): AgentRunState {
  const now = input.now || new Date().toISOString()
  const agents: Array<{ agent: AgentId; sectionId?: string }> = [
    { agent: 'intake' },
    { agent: 'sources' },
    { agent: 'structure' },
    { agent: 'planning' },
    ...input.sectionIds.map((sectionId) => ({ agent: 'writing' as const, sectionId })),
    { agent: 'citation' },
    { agent: 'review' },
    { agent: 'export' },
  ]
  return {
    runId: input.runId,
    projectId: input.projectId,
    mode: input.mode,
    sourcePolicy: input.sourcePolicy,
    status: 'pending',
    steps: agents.map((entry, order) => ({
      id: `${input.runId}:${entry.agent}:${entry.sectionId || order}`,
      agent: entry.agent,
      verifier: `${entry.agent}_verifier`,
      sectionId: entry.sectionId,
      order,
      attempt: 1,
      status: 'pending',
    })),
    updatedAt: now,
  }
}

export function nextRunnableStep(run: AgentRunState): AgentStepRecord | null {
  if (run.status === 'paused' || run.status === 'blocked' || run.status === 'failed' || run.status === 'completed') return null
  const index = run.steps.findIndex((step) => step.status === 'pending' || step.status === 'retrying')
  if (index < 0) return null
  if (run.steps.slice(0, index).some((step) => step.status !== 'verified')) return null
  return run.steps[index]
}

export function recordStepVerification(
  run: AgentRunState,
  stepId: string,
  verification: VerificationResultV1,
  now = new Date().toISOString(),
): AgentRunState {
  const index = run.steps.findIndex((step) => step.id === stepId)
  if (index < 0) throw new Error(`Korak ${stepId} ne postoji u runu.`)
  const current = run.steps[index]
  const attempt = verification.status === 'needs_revision'
    ? Math.min(3, current.attempt + 1) as 1 | 2 | 3
    : current.attempt
  const status: AgentStepStatus = verification.status === 'verified'
    ? 'verified'
    : verification.status === 'needs_revision'
      ? current.attempt >= 3 ? 'blocked' : 'retrying'
      : verification.status
  const steps = run.steps.map((step, stepIndex) => stepIndex === index
    ? { ...step, attempt, status, lastVerification: verification }
    : step)
  const nextStatus: AgentRunStatus = status === 'blocked'
    ? 'blocked'
    : status === 'failed'
      ? 'failed'
      : steps.every((step) => step.status === 'verified')
        ? 'completed'
        : 'running'
  return { ...run, steps, status: nextStatus, updatedAt: now }
}

export function resultForStep(step: AgentStepRecord, result: Omit<AgentResultV1, 'agent'>): AgentResultV1 {
  return { ...result, agent: step.agent }
}
