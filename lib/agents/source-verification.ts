import type { CitationEvidence, CitationVerification, CitationVerificationMethod } from './contracts'

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i
const DEFAULT_TIMEOUT_MS = 8_000
const MAX_REGISTRY_RESPONSE_BYTES = 512 * 1024

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface IndependentCitationVerifier {
  verify: (citations: CitationEvidence[]) => Promise<CitationEvidence[]>
}

export function createIndependentCitationVerifier({
  fetchImpl = fetch,
  now = () => new Date().toISOString(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  fetchImpl?: FetchImplementation
  now?: () => string
  timeoutMs?: number
} = {}): IndependentCitationVerifier {
  return {
    verify: async (citations) => Promise.all(citations.map((citation) => verifyCitation(citation, { fetchImpl, now, timeoutMs }))),
  }
}

async function verifyCitation(
  citation: CitationEvidence,
  input: { fetchImpl: FetchImplementation; now: () => string; timeoutMs: number },
): Promise<CitationEvidence> {
  const doi = normalizeDoi(citation.doi)
  if (doi) return verifyDoi(citation, doi, input)

  if (isHttpUrl(citation.url)) {
    return withVerification(citation, {
      status: 'needs_review',
      method: 'url_fetch',
      checkedAt: input.now(),
      evidenceUrl: citation.url.trim(),
    })
  }

  return withVerification(citation, {
    status: 'blocked',
    method: 'url_fetch',
    checkedAt: input.now(),
  })
}

async function verifyDoi(
  citation: CitationEvidence,
  doi: string,
  input: { fetchImpl: FetchImplementation; now: () => string; timeoutMs: number },
): Promise<CitationEvidence> {
  const verificationBase = { method: 'crossref' as const, checkedAt: input.now(), evidenceUrl: `https://api.crossref.org/works/${encodeURIComponent(doi)}` }
  try {
    const fetched = await fetchJsonWithTimeout(verificationBase.evidenceUrl, input)
    if (!fetched) return withVerification(citation, { ...verificationBase, status: 'needs_review' })
    const { response, body } = fetched
    if (!response.ok) return withVerification(citation, { ...verificationBase, status: 'needs_review' })
    const message = readCrossrefMessage(body)
    if (!message) return withVerification(citation, { ...verificationBase, status: 'needs_review' })

    const titleMatch = !citation.title || normalizeText(citation.title) === normalizeText(message.title)
    const authorMatch = !citation.authors || !citation.authors.trim()
      ? true
      : Boolean(message.authors && authorsMatch(citation.authors, message.authors))
    const yearMatch = !citation.year || (message.year !== undefined && citation.year === message.year)
    if (message.retracted) {
      return withVerification(citation, { ...verificationBase, status: 'blocked', titleMatch, authorMatch, yearMatch, retracted: true })
    }
    const status = titleMatch && authorMatch && yearMatch ? 'verified' : 'needs_review'
    return withVerification(citation, { ...verificationBase, status, titleMatch, authorMatch, yearMatch })
  } catch {
    return withVerification(citation, { ...verificationBase, status: 'needs_review' })
  }
}

async function readJsonResponse(response: Response, maxBytes: number): Promise<unknown> {
  const contentLength = Number(response.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

async function fetchJsonWithTimeout(
  url: string,
  input: { fetchImpl: FetchImplementation; timeoutMs: number },
): Promise<{ response: Response; body: unknown } | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), normalizeTimeout(input.timeoutMs))
  try {
    const response = await input.fetchImpl(url, { signal: controller.signal })
    const body = response.ok ? await readJsonResponse(response, MAX_REGISTRY_RESPONSE_BYTES) : null
    return { response, body }
  } finally {
    clearTimeout(timeout)
  }
}

function readCrossrefMessage(value: unknown): { title?: string; authors?: string; year?: number; retracted?: boolean } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const message = (value as { message?: unknown }).message
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null
  const candidate = message as { title?: unknown; author?: unknown; published?: { ['date-parts']?: unknown }; relation?: unknown; ['update-to']?: unknown }
  const title = Array.isArray(candidate.title) && typeof candidate.title[0] === 'string' ? candidate.title[0] : undefined
  const authors = Array.isArray(candidate.author)
    ? candidate.author.map((author) => {
      if (!author || typeof author !== 'object') return ''
      const value = author as { given?: unknown; family?: unknown }
      return [value.given, value.family].filter((part): part is string => typeof part === 'string' && Boolean(part.trim())).join(' ')
    }).filter(Boolean).join('; ')
    : ''
  const dateParts = candidate.published?.['date-parts']
  const year = Array.isArray(dateParts) && Array.isArray(dateParts[0]) && typeof dateParts[0][0] === 'number' ? dateParts[0][0] : undefined
  if (!title && !year && !authors) return null
  const retracted = containsRetractionMarker(candidate.relation) || containsRetractionMarker(candidate['update-to'])
  return { title, ...(authors ? { authors } : {}), year, ...(retracted ? { retracted: true } : {}) }
}

function authorsMatch(cited: string, registry: string): boolean {
  const citedTokens = new Set(normalizeText(cited).split(' ').filter((token) => token.length >= 2))
  const registryTokens = new Set(normalizeText(registry).split(' ').filter((token) => token.length >= 2))
  return citedTokens.size > 0 && [...citedTokens].every((token) => registryTokens.has(token))
}

function containsRetractionMarker(value: unknown): boolean {
  if (value === undefined || value === null) return false
  try {
    return /retract/i.test(JSON.stringify(value))
  } catch {
    return false
  }
}

function withVerification(citation: CitationEvidence, verification: CitationVerification): CitationEvidence {
  return { ...citation, verified: verification.status === 'verified', verification }
}

function normalizeDoi(value: string | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
  return DOI_PATTERN.test(normalized) ? normalized : null
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

function normalizeText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function normalizeTimeout(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(Math.trunc(value), 30_000)) : DEFAULT_TIMEOUT_MS
}

export function citationVerificationMethod(value: unknown): value is CitationVerificationMethod {
  return value === 'crossref' || value === 'url_fetch'
}
