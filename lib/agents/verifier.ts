import type { AgentId, AgentResultV1, CitationEvidence, VerificationIssue, VerificationResultV1 } from './contracts'
import { buildEvidenceGraph } from './evidence-graph'

export type AgentVerifier = (result: Pick<AgentResultV1, 'agent' | 'output' | 'citations' | 'claims'>, options?: VerifyAgentResultOptions) => VerificationResultV1

export interface VerifyAgentResultOptions {
  requireIndependentSourceVerification?: boolean
  requireIndependentPassageVerification?: boolean
}

const AGENT_VERIFIERS: Record<AgentId, AgentVerifier> = {
  intake: verifyIntakeResult,
  sources: verifySourcesResult,
  structure: verifyStructureResult,
  planning: verifyPlanningResult,
  writing: verifyWritingResult,
  citation: verifyCitationResult,
  review: verifyReviewResult,
  export: verifyExportResult,
}

export function verifierForAgent(agent: AgentId): AgentVerifier {
  return AGENT_VERIFIERS[agent]
}

export function verifyAgentResult(result: Pick<AgentResultV1, 'agent' | 'output' | 'citations' | 'claims'>, options: VerifyAgentResultOptions = {}): VerificationResultV1 {
  return verifierForAgent(result.agent)(result, options)
}

function verifyIntakeResult(result: Parameters<AgentVerifier>[0]): VerificationResultV1 {
  return verifyBasicResult(result)
}

function verifyStructureResult(result: Parameters<AgentVerifier>[0]): VerificationResultV1 {
  return verifyBasicResult(result)
}

function verifyPlanningResult(result: Parameters<AgentVerifier>[0]): VerificationResultV1 {
  return verifyBasicResult(result)
}

function verifyExportResult(result: Parameters<AgentVerifier>[0]): VerificationResultV1 {
  return verifyBasicResult(result)
}

function verifySourcesResult(result: Parameters<AgentVerifier>[0], options?: VerifyAgentResultOptions): VerificationResultV1 {
  return verifyCitationBoundResult(result, options)
}

function verifyWritingResult(result: Parameters<AgentVerifier>[0], options?: VerifyAgentResultOptions): VerificationResultV1 {
  return verifyCitationBoundResult(result, options)
}

function verifyCitationResult(result: Parameters<AgentVerifier>[0], options?: VerifyAgentResultOptions): VerificationResultV1 {
  return verifyCitationBoundResult(result, options)
}

function verifyReviewResult(result: Parameters<AgentVerifier>[0], options?: VerifyAgentResultOptions): VerificationResultV1 {
  return verifyCitationBoundResult(result, options)
}

function verifyBasicResult(result: Parameters<AgentVerifier>[0]): VerificationResultV1 {
  const citations = Array.isArray(result.citations) ? result.citations : []
  const issues: VerificationIssue[] = []

  if (typeof result.output !== 'string' || !result.output.trim()) {
    issues.push({ code: 'invalid_output', message: 'Agent nije vratio sadržaj za provjeru.' })
    return { status: 'needs_revision', issues, evidence: citations }
  }

  const incomplete = citations.filter((citation) => citation.verified && !hasValidCitationLocator(citation))
  incomplete.forEach((citation) => issues.push({
    code: 'incomplete_source',
    message: 'Provjereni izvor nema URL ili DOI.',
    citationId: citation.id,
  }))
  if (incomplete.length) return { status: 'needs_revision', issues, evidence: citations }

  const unverified = citations.filter((citation) => !citation.verified)
  unverified.forEach((citation) => issues.push({
    code: 'unverified_source',
    message: 'Izvor nije verificiran i ne smije ući u završni nacrt.',
    citationId: citation.id,
  }))
  if (unverified.length) return { status: 'blocked', issues, evidence: citations }

  return { status: 'verified', issues: [], evidence: citations }
}

function verifyCitationBoundResult(result: Parameters<AgentVerifier>[0], options: VerifyAgentResultOptions = {}): VerificationResultV1 {
  const base = verifyBasicResult(result)
  if (base.status !== 'verified') return base

  const citations = Array.isArray(result.citations) ? result.citations : []
  const requireIndependentSourceVerification = options.requireIndependentSourceVerification !== false
  const issues: VerificationIssue[] = []
  if (!Array.isArray(result.claims) || result.claims.length === 0) {
    return {
      status: 'blocked',
      issues: [{ code: 'missing_claim_evidence', message: 'Rezultat nema strukturiranu mapu tvrdnji prema verificiranim izvorima.' }],
      evidence: citations,
    }
  }

  const missingClaimEvidence = (result.claims || []).filter((claim) => !Array.isArray(claim.citationIds) || !claim.citationIds.some((citationId) => hasVerifiedCitation(citations, citationId)))
  missingClaimEvidence.forEach((claim) => issues.push({
    code: 'missing_claim_evidence',
    message: 'Činjenična tvrdnja nema povezani verificirani izvor.',
    citationId: claim.id,
  }))
  if (missingClaimEvidence.length) return { status: 'blocked', issues, evidence: citations }

  if (!citations.length) {
    return {
      status: 'blocked',
      issues: [{ code: 'missing_source', message: 'Nema provjerenog izvora za rezultat.' }],
      evidence: citations,
    }
  }

  if (requireIndependentSourceVerification) {
    const independentFailures = citations.filter((citation) => citation.verified && !hasIndependentCitationVerification(citation))
    if (independentFailures.length) {
      return {
        status: 'blocked',
        issues: independentFailures.map((citation) => ({
          code: 'unverified_source' as const,
          message: 'Izvor nema neovisnu provjeru identiteta i ne smije u završni nacrt.',
          citationId: citation.id,
        })),
        evidence: citations,
      }
    }

    const graph = buildEvidenceGraph(result, { ...options, requireIndependentSourceVerification })
    if (graph.status === 'needs_passage') {
      return {
        status: 'needs_revision',
        issues: graph.claims
          .filter((claim) => claim.status === 'needs_passage')
          .map((claim) => ({
            code: options.requireIndependentPassageVerification ? 'unverified_passage_evidence' as const : 'missing_passage_evidence' as const,
            message: options.requireIndependentPassageVerification
              ? 'Odlomak postoji, ali još nije prošao neovisnu provjeru veze s tvrdnjom.'
              : 'Tvrdnja ima verificiran identitet izvora, ali nema vezani odlomak za ručnu provjeru.',
            citationId: claim.citationIds[0],
          })),
        evidence: citations,
      }
    }
    if (graph.status === 'blocked') {
      return {
        status: 'blocked',
        issues: graph.claims
          .filter((claim) => claim.status === 'blocked')
          .map((claim) => ({
            code: 'unsupported_passage_evidence' as const,
            message: 'Dokazni odlomak nije vezan uz citat koji podržava ovu tvrdnju.',
            citationId: claim.citationIds[0],
          })),
        evidence: citations,
      }
    }
  }

  return { status: 'verified', issues, evidence: citations }
}

function hasIndependentCitationVerification(citation: CitationEvidence): boolean {
  const verification = citation.verification
  if (!verification || verification.status !== 'verified') return false
  if (typeof verification.checkedAt !== 'string' || !verification.checkedAt.trim()) return false
  if (!Number.isFinite(Date.parse(verification.checkedAt))) return false
  if (verification.retracted === true) return false
  if (!isHttpUrl(verification.evidenceUrl)) return false
  if (verification.method !== 'crossref') return false
  return typeof citation.doi === 'string'
    && /^10\.\d{4,9}\/\S+$/i.test(citation.doi.trim())
    && verification.titleMatch === true
    && verification.authorMatch === true
    && verification.yearMatch === true
}

export function hasVerifiedCitation(citations: CitationEvidence[], citationId: string): boolean {
  return citations.some((citation) => citation.id === citationId && citation.verified && hasValidCitationLocator(citation))
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
