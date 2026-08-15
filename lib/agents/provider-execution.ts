import type { AgentInput, AgentProvider, AgentResultV1, ClaimEvidence, UsageRecord } from './contracts'

const STRUCTURED_EVIDENCE_INSTRUCTION = [
  'Vrati završni rezultat isključivo kao JSON objekt bez markdown omota.',
  'Oblik: {"output":"tekst rezultata","claims":[{"id":"claim-1","text":"činjenična tvrdnja","citationIds":["source-id"]}]}',
  'Svaka činjenična tvrdnja mora navesti barem jedan ID verificiranog izvora iz konteksta.',
  'Ako rezultat nema činjenične tvrdnje, vrati claims kao prazno polje [].',
  'Ne izmišljaj source ID-jeve i ne koristi izvore koji nisu poslani u kontekstu.',
].join(' ')

export class RetryableAgentProviderError extends Error {
  readonly retryable = true

  constructor(message: string) {
    super(message)
    this.name = 'RetryableAgentProviderError'
  }
}

export function isRetryableAgentProviderError(error: unknown): boolean {
  return error instanceof RetryableAgentProviderError
    || Boolean(error && typeof error === 'object' && (error as { retryable?: unknown }).retryable === true)
}

export async function executeAgentProvider(
  provider: AgentProvider,
  input: AgentInput,
): Promise<Omit<AgentResultV1, 'agent'>> {
  let streamedOutput = ''
  let completedOutput: string | undefined
  let usage: UsageRecord | undefined
  const providerInput = withStructuredEvidenceInstruction(input)

  for await (const event of provider.run(providerInput)) {
    if (event.type === 'delta') {
      streamedOutput += event.value
      continue
    }
    if (event.type === 'error') {
      throw event.retryable ? new RetryableAgentProviderError(event.message) : new Error(event.message)
    }
    if (typeof event.value?.output !== 'string' || !isUsage(event.value.usage)) {
      throw new RetryableAgentProviderError('Provider nije vratio valjan završni rezultat.')
    }
    completedOutput = event.value.output
    usage = event.value.usage
  }

  if (completedOutput === undefined || usage === undefined) {
    throw new RetryableAgentProviderError('Provider nije završio agentni rezultat.')
  }

  const parsed = parseStructuredAgentOutput(completedOutput || streamedOutput)
  return {
    output: parsed.output,
    citations: [],
    ...(parsed.claims ? { claims: parsed.claims } : {}),
    provider: provider.id,
    usage,
  }
}

function withStructuredEvidenceInstruction(input: AgentInput): AgentInput {
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) return input
  const payload = input.payload as Record<string, unknown>
  if (payload.system !== undefined && typeof payload.system !== 'string') return input
  const existingSystem = typeof payload.system === 'string' ? payload.system.trim() : ''
  return {
    ...input,
    payload: {
      ...payload,
      system: [existingSystem, STRUCTURED_EVIDENCE_INSTRUCTION].filter(Boolean).join('\n\n'),
    },
  }
}

function parseStructuredAgentOutput(value: string): { output: string; claims?: ClaimEvidence[] } {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { output: value }
    const candidate = parsed as { output?: unknown; claims?: unknown }
    if (typeof candidate.output !== 'string' || !Array.isArray(candidate.claims)) return { output: value }
    if (!candidate.claims.every(isClaimEvidence)) return { output: value }
    return { output: candidate.output, claims: candidate.claims }
  } catch {
    return { output: value }
  }
}

function isClaimEvidence(value: unknown): value is ClaimEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const claim = value as Record<string, unknown>
  return typeof claim.id === 'string'
    && claim.id.trim().length > 0
    && typeof claim.text === 'string'
    && claim.text.trim().length > 0
    && Array.isArray(claim.citationIds)
    && claim.citationIds.every((citationId) => typeof citationId === 'string' && citationId.trim().length > 0)
}

function isUsage(value: unknown): value is UsageRecord {
  if (!value || typeof value !== 'object') return false
  const usage = value as Record<string, unknown>
  return Number.isFinite(usage.inputTokens)
    && Number.isFinite(usage.outputTokens)
    && Number(usage.inputTokens) >= 0
    && Number(usage.outputTokens) >= 0
}
