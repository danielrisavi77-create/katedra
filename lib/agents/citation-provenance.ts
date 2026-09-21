import type { CitationEvidence } from './contracts'

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i

/**
 * Determines whether a citation carries the complete provenance envelope
 * required by the strict agentic source gate. Provider-supplied booleans are
 * deliberately insufficient: the envelope must identify the independent
 * Crossref check and record every metadata comparison decision.
 */
export function hasIndependentCitationVerification(citation: CitationEvidence): boolean {
  const verification = citation.verification
  if (!verification || verification.status !== 'verified') return false
  if (typeof verification.checkedAt !== 'string' || !verification.checkedAt.trim()) return false
  if (!Number.isFinite(Date.parse(verification.checkedAt))) return false
  if (verification.retracted === true) return false
  if (!isHttpUrl(verification.evidenceUrl)) return false
  if (verification.method !== 'crossref') return false
  return typeof citation.doi === 'string'
    && DOI_PATTERN.test(citation.doi.trim())
    && verification.titleMatch === true
    && verification.authorMatch === true
    && verification.yearMatch === true
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value.trim())
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}
