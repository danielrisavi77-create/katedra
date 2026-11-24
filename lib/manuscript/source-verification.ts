import { createIndependentCitationVerifier } from '../agents/source-verification'
import type { CitationEvidence } from '../agents/contracts'
import type { ManuscriptSourceV1 } from './types'

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export function verifyManuscriptSource(
  source: ManuscriptSourceV1,
  options: { fetchImpl?: FetchImplementation; now?: () => string } = {},
): Promise<ManuscriptSourceV1> {
  const locator = source.urlOrDoi?.trim() || ''
  const citation: CitationEvidence = {
    id: source.id,
    title: source.title,
    ...(source.authors ? { authors: source.authors } : {}),
    ...(parseYear(source.year) !== undefined ? { year: parseYear(source.year) } : {}),
    ...(isDoi(locator) ? { doi: locator } : { url: locator }),
    verified: source.verified,
  }
  return createIndependentCitationVerifier(options).verify([citation]).then(([result]) => ({
    ...source,
    verified: result.verified,
    ...(result.verification ? { verification: result.verification } : {}),
  }))
}

function isDoi(value: string): boolean {
  return DOI_PATTERN.test(value.replace(/^doi:\s*/i, '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, ''))
}

function parseYear(value: string | undefined): number | undefined {
  if (!value || !/^\d{4}$/.test(value.trim())) return undefined
  return Number(value)
}
