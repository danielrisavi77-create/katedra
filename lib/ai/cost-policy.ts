export const AI_COST_LIMITS = {
  maxInputChars: 20_000,
  maxAttachmentChars: 28_000_000,
  maxDailyCharge: 100_000,
  maxActiveStreams: 2,
} as const

export const AI_MODEL_COST_MULTIPLIERS: Record<string, number> = {
  'claude-haiku-4-5-20251001': 1 / 3,
  'claude-sonnet-5': 1,
  'claude-opus-5': 5 / 3,
}

export function estimateChatCharge({
  inputChars,
  attachmentChars,
  model,
  maxOutputTokens,
  outputWeight,
}: {
  inputChars: number
  attachmentChars?: number
  model: string
  maxOutputTokens: number
  outputWeight: number
}) {
  const inputTokens = Math.ceil((Math.max(0, inputChars) + Math.max(0, attachmentChars ?? 0)) / 4)
  const multiplier = AI_MODEL_COST_MULTIPLIERS[model] ?? AI_MODEL_COST_MULTIPLIERS['claude-sonnet-5']
  return Math.ceil((inputTokens + outputWeight * maxOutputTokens) * multiplier)
}

export function maxAffordableOutputTokens({
  balance,
  minimumBalance,
  inputChars,
  attachmentChars,
  model,
  outputWeight,
  maxOutputTokens,
}: {
  balance: number
  minimumBalance: number
  inputChars: number
  attachmentChars?: number
  model: string
  outputWeight: number
  maxOutputTokens: number
}) {
  const inputTokens = Math.ceil((Math.max(0, inputChars) + Math.max(0, attachmentChars ?? 0)) / 4)
  const multiplier = AI_MODEL_COST_MULTIPLIERS[model] ?? AI_MODEL_COST_MULTIPLIERS['claude-sonnet-5']
  const availableForOutput = (balance - minimumBalance) / multiplier - inputTokens
  if (availableForOutput <= 0 || outputWeight <= 0) return 0
  return Math.max(0, Math.min(maxOutputTokens, Math.floor(availableForOutput / outputWeight)))
}

export type CostPolicyInput = {
  balance: number
  minimumBalance: number
  estimatedCharge: number
  dailyUsed: number
  dailyCeiling: number
  activeStreams: number
  maxActiveStreams?: number
  inputChars: number
  attachmentChars?: number
  maxInputChars?: number
  maxAttachmentChars?: number
}

export type CostPolicyResult =
  | { ok: true }
  | { ok: false; reason: 'request_too_large' | 'daily_ceiling' | 'insufficient_balance' | 'concurrency'; status: 402 | 413 | 429 }

export function validateCostCeiling(input: CostPolicyInput): CostPolicyResult {
  const maxInputChars = input.maxInputChars ?? AI_COST_LIMITS.maxInputChars
  const maxAttachmentChars = input.maxAttachmentChars ?? AI_COST_LIMITS.maxAttachmentChars
  if (input.inputChars > maxInputChars || (input.attachmentChars ?? 0) > maxAttachmentChars) {
    return { ok: false, reason: 'request_too_large', status: 413 }
  }

  const maxActiveStreams = input.maxActiveStreams ?? AI_COST_LIMITS.maxActiveStreams
  if (input.activeStreams >= maxActiveStreams) {
    return { ok: false, reason: 'concurrency', status: 429 }
  }

  if (input.dailyUsed + input.estimatedCharge > input.dailyCeiling) {
    return { ok: false, reason: 'daily_ceiling', status: 429 }
  }

  if (input.balance - input.estimatedCharge < input.minimumBalance) {
    return { ok: false, reason: 'insufficient_balance', status: 402 }
  }

  return { ok: true }
}
