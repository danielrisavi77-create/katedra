import { PlanApprovalRequiredError } from './plan-approval'
import type { AgentResultV1, VerificationResultV1 } from './contracts'
import { claimAgentStep, completeAgentStep, type AgentBackendResult, type AgentRunControlStatus } from './backend-contract'
import type { AgentStepRecord } from './run-state'
import { ProviderCapabilityError } from './provider-router'
import { isRetryableAgentProviderError } from './provider-execution'
import { AgentBillingReconciliationError } from './billed-provider-execution'

export type WorkerStepStatus = 'idle' | 'verified' | 'retrying' | 'blocked' | 'failed' | 'reconciliation_pending' | AgentRunControlStatus

export interface AgentWorkerDependencies {
  db: { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data?: unknown; error?: { message?: string } | null }> }
  workerId: string
  runId: string
  storeResult?: (input: { step: AgentStepRecord; result: Omit<AgentResultV1, 'agent'>; verification: VerificationResultV1 }) => Promise<{ manifestId: string }>
}

export async function processClaimedAgentStep(
  dependencies: AgentWorkerDependencies,
  handlers: {
    execute: (step: AgentStepRecord) => Promise<Omit<AgentResultV1, 'agent'>>
    /** Sinkroni ili async verifikator; od gate integracije dobiva i korak (za fazu, attempt, sectionId). */
    verify: (result: AgentResultV1, context: { step: AgentStepRecord }) => VerificationResultV1 | Promise<VerificationResultV1>
  },
): Promise<{ status: WorkerStepStatus; stepId?: string; error?: string }> {
  const claimed = await claimAgentStep(dependencies.db, { runId: dependencies.runId, workerId: dependencies.workerId })
  if (claimed.ok === false) return { status: 'failed', error: claimed.error }
  if (claimed.backendStatus) return { status: claimed.backendStatus }
  if (!claimed.value) return { status: 'idle' }

  const step = claimed.value
  let result: Omit<AgentResultV1, 'agent'>
  let verification: VerificationResultV1
  try {
    result = await handlers.execute(step)
    verification = await handlers.verify({ ...result, agent: step.agent }, { step })
  } catch (error) {
    if (error instanceof AgentBillingReconciliationError) {
      // Preserve this attempt for original-response recovery after lease expiry.
      // Never publish an empty placeholder or terminal failure for uncertain billing.
      return { status: 'reconciliation_pending', stepId: step.id,
        error: 'Agent execution requires canonical reconciliation.' }
    }
    verification = error instanceof PlanApprovalRequiredError
      ? { status: 'blocked', issues: [{ code: 'gate_finding', message: 'Pregledaj i izričito odobri plan prije nastavka pisanja.' }], evidence: [] }
      : error instanceof ProviderCapabilityError
      ? { status: 'blocked', issues: [{ code: 'provider_capability_unavailable', message: 'Ovaj korak trenutno nije dostupan jer potreban AI alat nije konfiguriran.' }], evidence: [] }
      : isRetryableAgentProviderError(error)
        ? { status: 'needs_revision', issues: [{ code: 'invalid_output', message: 'AI provider je privremeno nedostupan; pokušat ću ponovno.' }], evidence: [] }
      : { status: 'failed', issues: [{ code: 'invalid_output', message: 'Agent nije uspio dovršiti ovaj korak.' }], evidence: [] }
    result = {
      output: '',
      citations: [],
      provider: 'unknown',
      usage: { inputTokens: 0, outputTokens: 0 },
      ...(verification.billingState ? { billingState: verification.billingState } : {}),
    }
  }

  let completionVerification = verification
  if (dependencies.storeResult) {
    try {
      const stored = await dependencies.storeResult({ step, result, verification })
      completionVerification = { ...verification, resultPayloadId: stored.manifestId }
    } catch {
      // A lost Storage acknowledgement does not invalidate the paid original.
      // Leave its canonical lease/attempt recoverable without a terminal write.
      return { status: 'reconciliation_pending', stepId: step.id,
        error: 'Agent result storage requires canonical reconciliation.' }
    }
  }
  const hasUsage = Boolean(result.usage && (result.usage.inputTokens > 0 || result.usage.outputTokens > 0))
  const status: 'verified' | 'blocked' | 'failed' = completionVerification.status === 'verified' && hasUsage
    ? 'verified'
    : completionVerification.status === 'blocked' || (completionVerification.status === 'needs_revision' && step.attempt >= 3)
      ? 'blocked'
      : 'failed'
  const completion = await completeAgentStep(dependencies.db, {
    runId: dependencies.runId,
    stepId: step.id,
    workerId: dependencies.workerId,
    status,
    attempt: step.attempt,
    provider: result.provider,
    usage: result.usage || { inputTokens: 0, outputTokens: 0 },
    verification: completionVerification,
    requeue: status === 'failed' && completionVerification.status === 'needs_revision' && step.attempt < 3,
  })
  if (completion.ok === false) return { status: 'failed', stepId: step.id, error: completion.error }
  if ('value' in completion && (completion.value.status === 'paused' || completion.value.status === 'cancelled')) {
    return { status: completion.value.status, stepId: step.id }
  }
  if (status === 'verified') return { status, stepId: step.id }
  if (status === 'blocked') return { status, stepId: step.id }
  if (status === 'failed' && completionVerification.status !== 'needs_revision') return { status, stepId: step.id }
  return { status: 'retrying', stepId: step.id }
}
