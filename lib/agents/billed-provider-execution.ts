import { buildBillingConsumeParams, resolveBillingOutcome } from '../ai/billing-contract'
import { AI_MODEL_COST_MULTIPLIERS, estimateChatCharge } from '../ai/cost-policy'
import { reserveDistributedRequest } from '../ai/rate-limit.js'
import type { AgentInput, AgentProvider, AgentResultV1, UsageRecord } from './contracts'
import { executeAgentProvider } from './provider-execution'

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
    model: string
    maxOutputTokens?: number
  },
): Promise<Omit<AgentResultV1, 'agent'>> {
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
  if (!reservation.allowed) {
    throw new AgentBillingReconciliationError(`Agent billing reservation denied: ${reservation.reason}`, 'released')
  }

  try {
    const result = await executeAgentProvider(input.provider, input.agentInput)
    const usage = normalizeUsage(result.usage)
    if (!usage || (usage.inputTokens <= 0 && usage.outputTokens <= 0)) {
      throw new AgentBillingReconciliationError('Agent billing usage unavailable.', 'released')
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
      throw new AgentBillingReconciliationError('Agent billing finalization unavailable.', 'pending_reconciliation')
    }
    if (settled.error) throw new AgentBillingReconciliationError('Agent billing finalization failed.', 'pending_reconciliation')

    const status = (settled.data as { status?: unknown } | null)?.status
    const outcome = resolveBillingOutcome({
      provider: 'completed',
      usage,
      rpc: status === 'already_settled' ? 'already_settled' : status === 'settled' ? 'settled' : 'unknown',
    })
    if (outcome.state !== 'settled') {
      throw new AgentBillingReconciliationError(`Agent billing outcome: ${outcome.state}.`, outcome.state)
    }
    return { ...result, usage, billingState: outcome.state }
  } finally {
    await reservation.release().catch(() => undefined)
  }
}

function normalizeUsage(value: UsageRecord | undefined): UsageRecord | null {
  if (!value || !Number.isFinite(value.inputTokens) || !Number.isFinite(value.outputTokens)) return null
  if (value.inputTokens < 0 || value.outputTokens < 0) return null
  return {
    inputTokens: Math.floor(value.inputTokens),
    outputTokens: Math.floor(value.outputTokens),
  }
}
