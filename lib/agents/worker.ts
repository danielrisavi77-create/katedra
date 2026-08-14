import type { AgentResultV1, VerificationResultV1 } from './contracts'
import { claimAgentStep, completeAgentStep, type AgentBackendResult, type AgentRunControlStatus } from './backend-contract'
import type { AgentStepRecord } from './run-state'
import { ProviderCapabilityError } from './provider-router'
import { isRetryableAgentProviderError } from './provider-execution'
import { AgentBillingReconciliationError } from './billed-provider-execution'

export type WorkerStepStatus = 'idle' | 'verified' | 'retrying' | 'blocked' | 'failed' | AgentRunControlStatus

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
    verify: (result: AgentResultV1) => VerificationResultV1
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
    verification = handlers.verify({ ...result, agent: step.agent })
  } catch (error) {
    verification = error instanceof AgentBillingReconciliationError
      ? {
        status: 'failed',
        billingState: error.billingState,
        issues: [{
          code: error.billingState === 'pending_reconciliation' ? 'billing_reconciliation_pending' : 'billing_released',
          message: error.message,
        }],
        evidence: [],
      }
      : error instanceof ProviderCapabilityError
      ? { status: 'blocked', issues: [{ code: 'provider_capability_unavailable', message: error.message }], evidence: [] }
      : isRetryableAgentProviderError(error)
        ? { status: 'needs_revision', issues: [{ code: 'invalid_output', message: error instanceof Error ? error.message : 'Provider je privremeno nedostupan.' }], evidence: [] }
      : { status: 'failed', issues: [{ code: 'invalid_output', message: error instanceof Error ? error.message : 'Agent nije uspio.' }], evidence: [] }
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
    } catch (error) {
      const billingState = verification.billingState
      completionVerification = {
        status: 'failed',
        issues: [...verification.issues, { code: 'invalid_output', message: error instanceof Error ? error.message : 'Rezultat agenta nije moguće spremiti.' }],
        evidence: verification.evidence,
      }
      if (billingState) completionVerification.billingState = billingState
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
