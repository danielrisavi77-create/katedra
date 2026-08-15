import type { AgentResultV1, CitationEvidence, VerificationIssue, VerificationResultV1 } from './contracts'

export function verifyAgentResult(result: Pick<AgentResultV1, 'agent' | 'output' | 'citations' | 'claims'>): VerificationResultV1 {
  const citations = Array.isArray(result.citations) ? result.citations : []
  const issues: VerificationIssue[] = []

  if (typeof result.output !== 'string' || !result.output.trim()) {
    issues.push({ code: 'invalid_output', message: 'Agent nije vratio sadržaj za provjeru.' })
    return { status: 'failed', issues, evidence: citations }
  }

  const incomplete = citations.filter((citation) => citation.verified && !citation.url && !citation.doi)
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

  const citationRequired = result.agent === 'sources' || result.agent === 'writing' || result.agent === 'citation' || result.agent === 'review'
  if (citationRequired && !Array.isArray(result.claims)) {
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

  if (!citations.length && citationRequired) {
    return {
      status: 'blocked',
      issues: [{ code: 'missing_source', message: 'Nema provjerenog izvora za rezultat.' }],
      evidence: citations,
    }
  }

  return { status: 'verified', issues: [], evidence: citations }
}

export function hasVerifiedCitation(citations: CitationEvidence[], citationId: string): boolean {
  return citations.some((citation) => citation.id === citationId && citation.verified && Boolean(citation.url || citation.doi))
}
