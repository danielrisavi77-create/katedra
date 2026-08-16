import { buildBillingConsumeParams, buildBillingPendingParams, resolveBillingOutcome } from '../ai/billing-contract'
import { AI_MODEL_COST_MULTIPLIERS, estimateChatCharge } from '../ai/cost-policy'
import { releaseRateLimitReservation, reserveDistributedRequest } from '../ai/rate-limit.js'
import type { AgentInput, AgentProvider, AgentResultV1, UsageRecord } from './contracts'
import { executeAgentProvider } from './provider-execution'
import { logAiEvent, safeErrorCode } from '../observability/ai-events'

const OUTPUT_WEIGHT = 5
const DEFAULT_MAX_OUTPUT_TOKENS = 4096

export class AgentBillingReconciliationError extends Error {
  readonly billingState: 'released' | 'pending_reconciliation'

  constructor(message: string, billingState: 'released' | 'pending_reconciliation') {
    super(message)
    this.name = 'AgentBillingReconciliationError'
    this.billingState = billingState
  }
}

export interface BillingDatabase {
  rpc: (functionName: string, params: Record<string, unknown>) => Promise<{ data?: unknown; error?: { message?: string } | null }>
}

export async function executeBilledAgentProvider(
  db: BillingDatabase,
  input: {
    provider: AgentProvider
    agentInput: AgentInput
    userId: string
    projectId: string
    requestId: string
    agent?: string
    model: string
    maxOutputTokens?: number
  },
): Promise<Omit<AgentResultV1, 'agent'>> {
  const startedAt = Date.now()
  const eventContext = {
    requestId: input.requestId,
    userId: input.userId,
    projectId: input.projectId,
    runId: input.agentInput.runId,
    agent: input.agent,
    provider: input.provider.id,
    model: input.model,
    attempt: input.agentInput.attempt,
  }
  const maxOutputTokens = input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
  const estimatedCharge = estimateChatCharge({
    inputChars: JSON.stringify(input.agentInput.payload || '').length,
    model: input.model,
    maxOutputTokens,
    outputWeight: OUTPUT_WEIGHT,
  })
  const reservation = await reserveDistributedRequest(db, {
    userId: input.userId,
    requestId: input.requestId,
    estimatedCharge,
  })
  const reservationRelease = reservation.release
  if (!reservation.allowed || typeof reservationRelease !== 'function') {
    logAiEvent({ ...eventContext, eventName: 'agent_billing_reservation_denied', reason: reservation.reason, outcome: 'released', latencyMs: Date.now() - startedAt }, 'error')
    throw new AgentBillingReconciliationError(`Agent billing reservation denied: ${reservation.reason}`, 'released')
  }

  try {
    let result
    try {
      result = await executeAgentProvider(input.provider, input.agentInput)
    } catch (error) {
      logAiEvent({ ...eventContext, eventName: 'agent_provider_failed', errorCode: safeErrorCode(error), outcome: 'failed', latencyMs: Date.now() - startedAt }, 'error')
      throw error
    }
    const usage = normalizeUsage(result.usage)
    if (!usage || (usage.inputTokens <= 0 && usage.outputTokens <= 0)) {
      const pending = await markPendingBilling(db, {
        requestId: input.requestId,
        userId: input.userId,
        projectId: input.projectId,
        model: input.model,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCharge,
      })
      if (!pending.ok) throw pendingMarkerFailure(input)
      logAiEvent({ ...eventContext, eventName: 'agent_billing_usage_unavailable', estimatedCharge, inputTokens: 0, outputTokens: 0, billingState: 'pending_reconciliation', outcome: 'pending_reconciliation', latencyMs: Date.now() - startedAt }, 'error')
      throw new AgentBillingReconciliationError('Agent billing usage unavailable.', 'pending_reconciliation')
    }

    const charged = Math.round((usage.inputTokens + OUTPUT_WEIGHT * usage.outputTokens) * (AI_MODEL_COST_MULTIPLIERS[input.model] ?? 1))
    let settled
    try {
      settled = await db.rpc('katedra_consume', buildBillingConsumeParams({
        requestId: input.requestId,
        userId: input.userId,
        projectId: input.projectId,
        charged,
        model: input.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      }))
    } catch {
      const pending = await markPendingBilling(db, {
        requestId: input.requestId,
        userId: input.userId,
        projectId: input.projectId,
        model: input.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        charged,
      })
      if (!pending.ok) throw pendingMarkerFailure(input)
      logAiEvent({ ...eventContext, eventName: 'agent_billing_pending_reconciliation', charged, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, billingState: 'pending_reconciliation', errorCode: 'consume_rpc_error', outcome: 'pending_reconciliation', latencyMs: Date.now() - startedAt }, 'error')
      throw new AgentBillingReconciliationError('Agent billing finalization unavailable.', 'pending_reconciliation')
    }
    if (settled.error) {
      const pending = await markPendingBilling(db, {
        requestId: input.requestId,
        userId: input.userId,
        projectId: input.projectId,
        model: input.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        charged,
      })
      if (!pending.ok) throw pendingMarkerFailure(input)
      logAiEvent({ ...eventContext, eventName: 'agent_billing_pending_reconciliation', charged, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, billingState: 'pending_reconciliation', errorCode: 'consume_rpc_rejected', outcome: 'pending_reconciliation', latencyMs: Date.now() - startedAt }, 'error')
      throw new AgentBillingReconciliationError('Agent billing finalization failed.', 'pending_reconciliation')
    }

    const status = (settled.data as { status?: unknown } | null)?.status
    const outcome = resolveBillingOutcome({
      provider: 'completed',
      usage,
      rpc: status === 'already_settled' ? 'already_settled' : status === 'settled' ? 'settled' : 'unknown',
    })
    if (outcome.state !== 'settled') {
      const pending = await markPendingBilling(db, {
        requestId: input.requestId,
        userId: input.userId,
        projectId: input.projectId,
        model: input.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        charged,
      })
      if (!pending.ok) throw pendingMarkerFailure(input)
      logAiEvent({ ...eventContext, eventName: 'agent_billing_pending_reconciliation', charged, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, billingState: 'pending_reconciliation', reason: outcome.reason, outcome: 'pending_reconciliation', latencyMs: Date.now() - startedAt }, 'error')
      throw new AgentBillingReconciliationError(`Agent billing outcome: ${outcome.state}.`, 'pending_reconciliation')
    }
    logAiEvent({ ...eventContext, eventName: 'agent_billing_settled', charged, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, billingState: outcome.state, outcome: 'settled', latencyMs: Date.now() - startedAt })
    return { ...result, usage, billingState: outcome.state }
  } finally {
    await releaseReservationWithRetry({ release: reservationRelease }, input)
  }
}

async function releaseReservationWithRetry(
  reservation: { release: () => void | Promise<void> },
  input: { requestId: string; userId: string; projectId: string },
) {
  await releaseRateLimitReservation(reservation, (error, attempt) => {
    logAiEvent({
      eventName: 'agent_rate_limit_release_failed',
      attempt,
      requestId: input.requestId,
      userId: input.userId,
      projectId: input.projectId,
      errorCode: safeErrorCode(error),
      outcome: 'pending_reconciliation',
    }, 'error')
  })
}

async function markPendingBilling(db: BillingDatabase, input: Parameters<typeof buildBillingPendingParams>[0]) {
  try {
    const result = await db.rpc('katedra_mark_pending', buildBillingPendingParams(input))
    if (result?.error) return { ok: false, error: result.error.message || 'Canonical pending marker returned an error.' }
    const status = result?.data && typeof result.data === 'object' && !Array.isArray(result.data)
      ? (result.data as Record<string, unknown>).status
      : undefined
    if (status !== 'pending_reconciliation') return { ok: false, error: 'Canonical pending marker did not confirm pending_reconciliation.' }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Canonical pending marker is unavailable.' }
  }
}

function pendingMarkerFailure(input: { requestId: string; userId: string; projectId: string }) {
  logAiEvent({
    eventName: 'agent_billing_pending_marker_failed',
    requestId: input.requestId,
    userId: input.userId,
    projectId: input.projectId,
    errorCode: 'pending_marker_rejected',
    outcome: 'pending_reconciliation',
  }, 'error')
  return new AgentBillingReconciliationError('Agent billing reconciliation marker unavailable.', 'pending_reconciliation')
}

function normalizeUsage(value: UsageRecord | undefined): UsageRecord | null {
  if (!value || !Number.isFinite(value.inputTokens) || !Number.isFinite(value.outputTokens)) return null
  if (value.inputTokens < 0 || value.outputTokens < 0) return null
  return {
    inputTokens: Math.floor(value.inputTokens),
    outputTokens: Math.floor(value.outputTokens),
  }
}
