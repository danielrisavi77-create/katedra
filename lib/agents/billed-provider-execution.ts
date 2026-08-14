import { buildBillingConsumeParams, resolveBillingOutcome } from '../ai/billing-contract'
import { AI_MODEL_COST_MULTIPLIERS, estimateChatCharge } from '../ai/cost-policy'
import { reserveDistributedRequest } from '../ai/rate-limit.js'
import type { AgentInput, AgentProvider, AgentResultV1, UsageRecord } from './contracts'
import { executeAgentProvider } from './provider-execution'

const OUTPUT_WEIGHT = 5
const DEFAULT_MAX_OUTPUT_TOKENS = 4096

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
    throw new Error(`Agent billing reservation denied: ${reservation.reason}`)
  }

  try {
    const result = await executeAgentProvider(input.provider, input.agentInput)
    const usage = normalizeUsage(result.usage)
    if (!usage || (usage.inputTokens <= 0 && usage.outputTokens <= 0)) {
      throw new Error('Agent billing usage unavailable.')
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
      throw new Error('Agent billing finalization unavailable.')
    }
    if (settled.error) throw new Error('Agent billing finalization failed.')

    const status = (settled.data as { status?: unknown } | null)?.status
    const outcome = resolveBillingOutcome({
      provider: 'completed',
      usage,
      rpc: status === 'already_settled' ? 'already_settled' : status === 'settled' ? 'settled' : 'unknown',
    })
    if (outcome.state !== 'settled') throw new Error(`Agent billing outcome: ${outcome.state}.`)
    return { ...result, usage }
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
