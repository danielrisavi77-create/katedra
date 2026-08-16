import type { AgentInput, AgentProvider, AgentResultV1, CitationEvidence, ClaimEvidence, ClaimSupport, UsageRecord } from './contracts'

const STRUCTURED_EVIDENCE_INSTRUCTION = [
  'Vrati završni rezultat isključivo kao JSON objekt bez markdown omota.',
  'Oblik: {"output":"tekst rezultata","claims":[{"id":"claim-1","text":"činjenična tvrdnja","citationIds":["source-id"],"support":[{"citationId":"source-id","quote":"kratak doslovni odlomak","locator":"str. 4"}]}]}',
  'Svaka činjenična tvrdnja mora navesti barem jedan ID verificiranog izvora iz konteksta.',
  'Za svaku tvrdnju priloži kratak doslovni odlomak iz izvora u support; passage je pomoć za ljudsku provjeru, ne dokaz sam po sebi.',
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
    citations: parsed.citations,
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

function parseStructuredAgentOutput(value: string): { output: string; citations: CitationEvidence[]; claims?: ClaimEvidence[] } {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { output: value, citations: [] }
    const candidate = parsed as { output?: unknown; citations?: unknown; claims?: unknown }
    if (typeof candidate.output !== 'string') return { output: value, citations: [] }
    const citations = candidate.citations === undefined
      ? []
      : Array.isArray(candidate.citations) && candidate.citations.every(isCitationEvidence)
        ? candidate.citations.map(asUnverifiedCitation)
        : []
    if (!Array.isArray(candidate.claims)) return { output: candidate.output, citations }
    if (!candidate.claims.every(isClaimEvidence)) return { output: candidate.output, citations }
    return { output: candidate.output, citations, claims: candidate.claims.map(normalizeClaimEvidence) }
  } catch {
    return { output: value, citations: [] }
  }
}

function isCitationEvidence(value: unknown): value is CitationEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const citation = value as Record<string, unknown>
  return typeof citation.id === 'string'
    && citation.id.trim().length > 0
    && typeof citation.verified === 'boolean'
    && (citation.title === undefined || typeof citation.title === 'string')
    && (citation.authors === undefined || typeof citation.authors === 'string')
    && (citation.year === undefined || (typeof citation.year === 'number' && Number.isInteger(citation.year)))
    && (citation.url === undefined || typeof citation.url === 'string')
    && (citation.doi === undefined || typeof citation.doi === 'string')
}

function asUnverifiedCitation(citation: CitationEvidence): CitationEvidence {
  return {
    id: citation.id,
    ...(citation.title ? { title: citation.title } : {}),
    ...(citation.authors ? { authors: citation.authors } : {}),
    ...(citation.year !== undefined ? { year: citation.year } : {}),
    ...(citation.url ? { url: citation.url } : {}),
    ...(citation.doi ? { doi: citation.doi } : {}),
    verified: false,
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
    && claim.citationIds.length <= 50
    && claim.citationIds.every((citationId) => typeof citationId === 'string' && citationId.trim().length > 0)
    && (claim.support === undefined || (Array.isArray(claim.support) && claim.support.length <= 20 && claim.support.every(isClaimSupport)))
}

function isClaimSupport(value: unknown): value is ClaimSupport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const support = value as Record<string, unknown>
  return typeof support.citationId === 'string'
    && support.citationId.trim().length > 0
    && typeof support.quote === 'string'
    && support.quote.trim().length > 0
    && support.quote.length <= 2_000
    && (support.locator === undefined || (typeof support.locator === 'string' && support.locator.length <= 200))
}

function normalizeClaimEvidence(claim: ClaimEvidence): ClaimEvidence {
  const support = Array.isArray(claim.support)
    ? claim.support.slice(0, 20).map((item) => ({
      citationId: item.citationId.trim().slice(0, 200),
      quote: item.quote.trim().slice(0, 2_000),
      ...(item.locator?.trim() ? { locator: item.locator.trim().slice(0, 200) } : {}),
    }))
    : undefined
  return {
    id: claim.id.trim().slice(0, 200),
    text: claim.text.trim().slice(0, 10_000),
    citationIds: claim.citationIds.slice(0, 50).map((citationId) => citationId.trim().slice(0, 200)),
    ...(support?.length ? { support } : {}),
  }
}

function isUsage(value: unknown): value is UsageRecord {
  if (!value || typeof value !== 'object') return false
  const usage = value as Record<string, unknown>
  return Number.isFinite(usage.inputTokens)
    && Number.isFinite(usage.outputTokens)
    && Number(usage.inputTokens) >= 0
    && Number(usage.outputTokens) >= 0
}
