export type BillingAttemptState =
  | 'reserved'
  | 'settled'
  | 'released'
  | 'pending_reconciliation'

export type BillingProviderState = 'completed' | 'failed' | 'aborted'
export type BillingRpcState = 'settled' | 'already_settled' | 'released' | 'timeout' | 'unavailable' | 'unknown'

export type BillingAttemptInput = {
  requestId?: string
  userId?: string
  projectId?: string
  model?: string
  inputTokens: number
  outputTokens: number
  charged?: number
}

export type BillingOutcomeInput = {
  provider: BillingProviderState
  usage: Pick<BillingAttemptInput, 'inputTokens' | 'outputTokens'>
  rpc: BillingRpcState
}

export type BillingOutcome = {
  state: Exclude<BillingAttemptState, 'reserved'>
  retry: boolean
  reason?: 'usage_unavailable' | 'rpc_timeout' | 'rpc_unavailable' | 'rpc_unknown'
}

function hasUsage(usage: BillingOutcomeInput['usage']) {
  return Number.isFinite(usage.inputTokens)
    && Number.isFinite(usage.outputTokens)
    && (usage.inputTokens > 0 || usage.outputTokens > 0)
}

export function resolveBillingOutcome(input: BillingOutcomeInput): BillingOutcome {
  const usageAvailable = hasUsage(input.usage)

  if (input.rpc === 'released') return { state: 'released', retry: false }

  if (input.rpc === 'settled' || input.rpc === 'already_settled') {
    if (usageAvailable) return { state: 'settled', retry: false }
    return { state: 'pending_reconciliation', retry: true, reason: 'usage_unavailable' }
  }

  if (input.rpc === 'timeout') {
    return { state: 'pending_reconciliation', retry: true, reason: 'rpc_timeout' }
  }

  if (input.rpc === 'unavailable') {
    return { state: 'pending_reconciliation', retry: true, reason: 'rpc_unavailable' }
  }

  if (input.rpc === 'unknown') {
    return { state: 'pending_reconciliation', retry: true, reason: 'rpc_unknown' }
  }

  if (input.provider === 'failed' && !usageAvailable) {
    return { state: 'released', retry: false }
  }

  return { state: 'pending_reconciliation', retry: true, reason: 'rpc_unknown' }
}

export function buildBillingConsumeParams(input: BillingAttemptInput) {
  return {
    p_user: input.userId,
    p_project_id: input.projectId,
    p_request_id: input.requestId,
    p_charged: input.charged,
    p_model: input.model,
    p_in: input.inputTokens,
    p_out: input.outputTokens,
  }
}
