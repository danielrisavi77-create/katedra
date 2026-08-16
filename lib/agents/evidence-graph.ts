import type { ClaimEvidence, ClaimSupport, ClaimSupportVerification, CitationEvidence } from './contracts'

export type EvidenceGraphClaimStatus = 'ready_for_review' | 'needs_passage' | 'blocked'
export type EvidenceGraphStatus = 'ready_for_review' | 'needs_passage' | 'blocked' | 'empty'

export interface EvidenceGraphClaim {
  claimId: string
  status: EvidenceGraphClaimStatus
  citationIds: string[]
  support: ClaimSupport[]
}

export interface EvidenceGraph {
  status: EvidenceGraphStatus
  claims: EvidenceGraphClaim[]
}

interface EvidenceGraphInput {
  claims?: ClaimEvidence[]
  citations: CitationEvidence[]
}

export interface BuildEvidenceGraphOptions {
  requireIndependentSourceVerification?: boolean
  requireIndependentPassageVerification?: boolean
}

const MAX_CLAIMS = 200
const MAX_SUPPORT_PER_CLAIM = 20
const MAX_QUOTE_CHARS = 2_000
const MAX_LOCATOR_CHARS = 200

/**
 * Builds an auditable claim-to-source map. This deliberately does not claim
 * semantic entailment: a quoted passage is a reviewable lead, not proof that
 * the generated claim is correct.
 */
export function buildEvidenceGraph(
  input: EvidenceGraphInput,
  options: BuildEvidenceGraphOptions = {},
): EvidenceGraph {
  const claims = Array.isArray(input.claims) ? input.claims.slice(0, MAX_CLAIMS) : []
  const citations = Array.isArray(input.citations) ? input.citations : []
  if (!claims.length) return { status: 'empty', claims: [] }

  const citationsById = new Map(citations.map((citation) => [citation.id, citation]))
  const graphClaims = claims.map((claim) => buildClaimNode(claim, citationsById, options))
  const status = graphClaims.some((claim) => claim.status === 'blocked')
    ? 'blocked'
    : graphClaims.some((claim) => claim.status === 'needs_passage')
      ? 'needs_passage'
      : 'ready_for_review'

  return { status, claims: graphClaims }
}

function buildClaimNode(
  claim: ClaimEvidence,
  citationsById: Map<string, CitationEvidence>,
  options: BuildEvidenceGraphOptions,
): EvidenceGraphClaim {
  const citationIds = uniqueStrings(claim.citationIds)
  const supports = normalizeSupports(claim.support)
  const mappedCitations = citationIds.map((id) => citationsById.get(id)).filter(isCitation)
  const hasVerifiedIdentity = mappedCitations.some((citation) => isVerifiedIdentity(citation, options))

  if (!citationIds.length || !hasVerifiedIdentity) {
    return { claimId: claim.id, status: 'blocked', citationIds, support: supports }
  }

  if (supports.some((support) => !citationIds.includes(support.citationId))) {
    return { claimId: claim.id, status: 'blocked', citationIds, support: supports }
  }

  if (!supports.length) {
    return { claimId: claim.id, status: 'needs_passage', citationIds, support: [] }
  }

  const unsupported = supports.some((support) => support.verification?.status === 'blocked' || support.verification?.claimSupported === 'contradicted')
  if (unsupported) {
    return { claimId: claim.id, status: 'blocked', citationIds, support: supports }
  }

  if (options.requireIndependentPassageVerification && !supports.some((support) => (
    support.verification?.status === 'verified'
      && support.verification.claimSupported === 'supported'
      && (support.verification.method === 'independent_gateway' || support.verification.method === 'deterministic_excerpt')
  ))) {
    return { claimId: claim.id, status: 'needs_passage', citationIds, support: supports }
  }

  return { claimId: claim.id, status: 'ready_for_review', citationIds, support: supports }
}

function isVerifiedIdentity(
  citation: CitationEvidence,
  options: BuildEvidenceGraphOptions,
): boolean {
  if (!citation.verified || !hasValidCitationLocator(citation)) return false
  if (!options.requireIndependentSourceVerification) return true
  return citation.verification?.status === 'verified'
}

function normalizeSupports(value: ClaimSupport[] | undefined): ClaimSupport[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_SUPPORT_PER_CLAIM).flatMap((support) => {
    if (!support || typeof support !== 'object') return []
    const citationId = typeof support.citationId === 'string' ? support.citationId.trim() : ''
    const quote = typeof support.quote === 'string' ? support.quote.trim() : ''
    const locator = typeof support.locator === 'string' ? support.locator.trim().slice(0, MAX_LOCATOR_CHARS) : ''
    if (!citationId || !quote || quote.length > MAX_QUOTE_CHARS) return []
    const verification = normalizeSupportVerification(support.verification)
    return [{ citationId, quote, ...(locator ? { locator } : {}), ...(verification ? { verification } : {}) }]
  })
}

function normalizeSupportVerification(value: unknown): ClaimSupportVerification | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const candidate = value as Record<string, unknown>
  const status = candidate.status
  const method = candidate.method
  const checkedAt = candidate.checkedAt
  if ((status !== 'verified' && status !== 'needs_review' && status !== 'blocked')
    || (method !== 'independent_gateway' && method !== 'deterministic_excerpt')
    || typeof checkedAt !== 'string'
    || !checkedAt.trim()) return undefined
  const claimSupported = candidate.claimSupported
  const confidence = typeof candidate.confidence === 'number' && Number.isFinite(candidate.confidence)
    ? Math.max(0, Math.min(1, candidate.confidence))
    : undefined
  const evidenceUrl = typeof candidate.evidenceUrl === 'string' && isHttpUrl(candidate.evidenceUrl) ? candidate.evidenceUrl.trim() : undefined
  return {
    status,
    method,
    checkedAt: checkedAt.slice(0, 80),
    ...(claimSupported === 'supported' || claimSupported === 'unclear' || claimSupported === 'contradicted' ? { claimSupported } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(evidenceUrl ? { evidenceUrl } : {}),
  }
}

function uniqueStrings(values: string[]): string[] {
  if (!Array.isArray(values)) return []
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).map((value) => value.trim()))]
}

function isCitation(value: CitationEvidence | undefined): value is CitationEvidence {
  return Boolean(value)
}

function hasValidCitationLocator(citation: CitationEvidence): boolean {
  if (typeof citation.url === 'string' && isHttpUrl(citation.url)) return true
  return typeof citation.doi === 'string' && /^10\.\d{4,9}\/\S+$/i.test(citation.doi.trim())
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}
