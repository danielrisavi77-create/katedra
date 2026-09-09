import type { ClaimEvidence, ClaimSupport, CitationEvidence, ClaimSupportAssessment, ClaimSupportVerificationStatus, UsageRecord } from './contracts'
import { executeBilledOperation, type BillingDatabase } from './billed-provider-execution'

import type { ProviderExecutionContext } from './provider-execution-recovery.server'

const DEFAULT_TIMEOUT_MS = 20_000
const MAX_RESPONSE_BYTES = 1_500_000
const MAX_CLAIMS = 200
const MAX_SUPPORT_PER_CLAIM = 20

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface PassageVerifierInput {
  projectId: string
  runId: string
  claims: ClaimEvidence[]
  citations: CitationEvidence[]
}

export interface PassageVerifier {
  verify(input: PassageVerifierInput): Promise<PassageVerificationResult>
}

export interface PassageVerificationResult {
  claims: ClaimEvidence[]
  provider: string
  model: string
  usage?: UsageRecord
  billingState?: 'settled' | 'released' | 'pending_reconciliation'
  charged?: number
  outcome: 'verified' | 'needs_review' | 'blocked'
}

interface PassageDecision {
  claimId: string
  citationId: string
  quote: string
  locator?: string
  status: ClaimSupportVerificationStatus
  claimSupported?: ClaimSupportAssessment
  confidence?: number
  evidenceUrl?: string
}

/**
 * Calls an explicitly configured independent evidence service. The service
 * may only annotate supports that exactly match the original claim and quote;
 * it cannot add citations, replace claims, or inject new passages.
 */
export function createGatewayPassageVerifier({
  endpoint,
  apiKey,
  model,
  provider = 'independent-verifier-gateway',
  fetchImpl = fetch,
  now = () => new Date().toISOString(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  endpoint: string
  apiKey: string
  model: string
  provider?: string
  fetchImpl?: FetchImplementation
  now?: () => string
  timeoutMs?: number
}): PassageVerifier {
  return {
    verify: async (input) => {
      const originalClaims = input.claims.slice(0, MAX_CLAIMS)
      const checkedAt = now()
      try {
        const response = await requestGateway({
          endpoint,
          apiKey,
          model,
          fetchImpl,
          timeoutMs,
          payload: passagePayload(input),
          projectId: input.projectId,
          runId: input.runId,
        })
        const gateway = readGatewayPayload(response)
        if (!gateway) return createResult(markNeedsReview(originalClaims, checkedAt), provider, model, undefined)
        const claims = annotateClaims(originalClaims, gateway.decisions, checkedAt)
        return createResult(claims, provider, model, gateway.usage)
      } catch {
        return createResult(markNeedsReview(originalClaims, checkedAt), provider, model, undefined)
      }
    },
  }
}

export async function executeBilledPassageVerification(
  db: BillingDatabase,
  input: {
    verifier: PassageVerifier
    provider: string
    model: string
    userId: string
    projectId: string
    runId: string
    requestId: string
    agent: string
    attempt: number
    execution: ProviderExecutionContext
    claims: ClaimEvidence[]
    citations: CitationEvidence[]
  },
): Promise<PassageVerificationResult> {
  const billed = await executeBilledOperation(db, {
    operation: 'passage',
    execution: input.execution,
    provider: input.provider,
    model: input.model,
    userId: input.userId,
    projectId: input.projectId,
    runId: input.runId,
    requestId: input.requestId,
    agent: input.agent,
    attempt: input.attempt,
    payload: passagePayload(input),
    execute: async () => {
      const result = await input.verifier.verify({
        projectId: input.projectId,
        runId: input.runId,
        claims: input.claims,
        citations: input.citations,
      })
      return { value: result, usage: result.usage }
    },
  })
  return {
    ...billed.value,
    usage: billed.usage,
    billingState: billed.billingState,
    charged: billed.charged,
  }
}

async function requestGateway(input: {
  endpoint: string
  apiKey: string
  model: string
  fetchImpl: FetchImplementation
  timeoutMs: number
  payload: Record<string, unknown>
  projectId: string
  runId: string
}): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), normalizeTimeout(input.timeoutMs))
  try {
    const response = await input.fetchImpl(input.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + input.apiKey,
      },
      body: JSON.stringify({
        model: input.model,
        projectId: input.projectId,
        runId: input.runId,
        task: input.payload.task,
        payload: input.payload,
      }),
      signal: controller.signal,
    })
    if (!response.ok) return null
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) return null
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) return null
    return JSON.parse(text) as unknown
  } finally {
    clearTimeout(timer)
  }
}

function passagePayload(input: PassageVerifierInput) {
  return { schemaVersion: 1, task: 'verify_claim_passages',
    citations: input.citations.slice(0, 100).map(publicCitation),
    claims: input.claims.slice(0, MAX_CLAIMS).map(publicClaim) }
}

function publicCitation(citation: CitationEvidence): Record<string, unknown> {
  return {
    id: citation.id,
    ...(citation.title ? { title: citation.title } : {}),
    ...(citation.authors ? { authors: citation.authors } : {}),
    ...(citation.year !== undefined ? { year: citation.year } : {}),
    ...(citation.url ? { url: citation.url } : {}),
    ...(citation.doi ? { doi: citation.doi } : {}),
  }
}

function publicClaim(claim: ClaimEvidence): Record<string, unknown> {
  return {
    id: claim.id,
    text: claim.text,
    citationIds: claim.citationIds,
    ...(claim.support ? {
      support: claim.support.slice(0, MAX_SUPPORT_PER_CLAIM).map((support) => ({
        citationId: support.citationId,
        quote: support.quote,
        ...(support.locator ? { locator: support.locator } : {}),
      })),
    } : {}),
  }
}

function readGatewayPayload(value: unknown): { decisions: PassageDecision[]; usage?: UsageRecord } | null {
  let candidate = value
  if (isRecord(candidate) && typeof candidate.output === 'string') {
    try {
      candidate = JSON.parse(candidate.output) as unknown
    } catch {
      return null
    }
  }
  if (!isRecord(candidate) || !Array.isArray(candidate.decisions)) return null
  const decisions = candidate.decisions.flatMap((item) => {
    if (!isRecord(item)) return []
    const status = item.status
    const claimSupported = item.claimSupported
    if (typeof item.claimId !== 'string' || typeof item.citationId !== 'string' || typeof item.quote !== 'string') return []
    if (status !== 'verified' && status !== 'needs_review' && status !== 'blocked') return []
    const decision: PassageDecision = {
      claimId: item.claimId.trim().slice(0, 200),
      citationId: item.citationId.trim().slice(0, 200),
      quote: item.quote.trim().slice(0, 2_000),
      ...(typeof item.locator === 'string' && item.locator.trim() ? { locator: item.locator.trim().slice(0, 200) } : {}),
      status: status as ClaimSupportVerificationStatus,
      ...(claimSupported === 'supported' || claimSupported === 'unclear' || claimSupported === 'contradicted' ? { claimSupported: claimSupported as ClaimSupportAssessment } : {}),
      ...(typeof item.confidence === 'number' && Number.isFinite(item.confidence) ? { confidence: clamp(item.confidence) } : {}),
      ...(typeof item.evidenceUrl === 'string' && isHttpUrl(item.evidenceUrl) ? { evidenceUrl: item.evidenceUrl.trim() } : {}),
    }
    return [decision]
  })
  const usage = isUsage(candidate.usage) ? candidate.usage : undefined
  return { decisions, ...(usage ? { usage } : {}) }
}

function createResult(claims: ClaimEvidence[], provider: string, model: string, usage: UsageRecord | undefined): PassageVerificationResult {
  const supports = claims.flatMap((claim) => claim.support || [])
  const outcome = supports.some((support) => support.verification?.status === 'blocked')
    ? 'blocked'
    : supports.length > 0 && supports.every((support) => support.verification?.status === 'verified')
      ? 'verified'
      : 'needs_review'
  return { claims, provider, model, outcome, ...(usage ? { usage } : {}) }
}

function annotateClaims(claims: ClaimEvidence[], decisions: PassageDecision[], checkedAt: string): ClaimEvidence[] {
  return claims.map((claim) => ({
    ...claim,
    ...(claim.support ? {
      support: claim.support.slice(0, MAX_SUPPORT_PER_CLAIM).map((support) => ({
        ...support,
        verification: decisionFor(claim.id, support, decisions, checkedAt),
      })),
    } : {}),
  }))
}

function markNeedsReview(claims: ClaimEvidence[], checkedAt: string): ClaimEvidence[] {
  return annotateClaims(claims, [], checkedAt)
}

function decisionFor(claimId: string, support: ClaimSupport, decisions: PassageDecision[], checkedAt: string) {
  const decision = decisions.find((candidate) => candidate.claimId === claimId
    && candidate.citationId === support.citationId
    && normalizeText(candidate.quote) === normalizeText(support.quote)
    && normalizeLocator(candidate.locator) === normalizeLocator(support.locator))
  return {
    status: decision?.status === 'blocked' || decision?.claimSupported === 'contradicted'
      ? 'blocked' as const
      : decision?.status === 'verified' && decision.claimSupported === 'supported'
        ? 'verified' as const
        : 'needs_review' as const,
    method: 'independent_gateway' as const,
    checkedAt,
    ...(decision?.claimSupported ? { claimSupported: decision.claimSupported } : {}),
    ...(decision?.confidence !== undefined ? { confidence: decision.confidence } : {}),
    ...(decision?.evidenceUrl ? { evidenceUrl: decision.evidenceUrl } : {}),
  }
}

function normalizeLocator(value: string | undefined): string {
  return (value || '').trim().toLocaleLowerCase()
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim()
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeTimeout(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(Math.trunc(value), 60_000)) : DEFAULT_TIMEOUT_MS
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isUsage(value: unknown): value is UsageRecord {
  if (!isRecord(value)) return false
  return Number.isInteger(value.inputTokens)
    && Number.isInteger(value.outputTokens)
    && Number(value.inputTokens) >= 0
    && Number(value.outputTokens) >= 0
}
