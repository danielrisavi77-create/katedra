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
    const response = await fetchWithTimeout(verificationBase.evidenceUrl, input)
    if (!response.ok) return withVerification(citation, { ...verificationBase, status: 'needs_review' })
    const body = await readJsonResponse(response, MAX_REGISTRY_RESPONSE_BYTES)
    const message = readCrossrefMessage(body)
    if (!message) return withVerification(citation, { ...verificationBase, status: 'needs_review' })

    const titleMatch = !citation.title || normalizeText(citation.title) === normalizeText(message.title)
    const yearMatch = !citation.year || !message.year || citation.year === message.year
    const status = titleMatch && yearMatch ? 'verified' : 'needs_review'
    return withVerification(citation, { ...verificationBase, status, titleMatch, yearMatch })
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

async function fetchWithTimeout(
  url: string,
  input: { fetchImpl: FetchImplementation; timeoutMs: number },
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), normalizeTimeout(input.timeoutMs))
  try {
    return await input.fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function readCrossrefMessage(value: unknown): { title?: string; year?: number } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const message = (value as { message?: unknown }).message
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null
  const candidate = message as { title?: unknown; published?: { ['date-parts']?: unknown } }
  const title = Array.isArray(candidate.title) && typeof candidate.title[0] === 'string' ? candidate.title[0] : undefined
  const dateParts = candidate.published?.['date-parts']
  const year = Array.isArray(dateParts) && Array.isArray(dateParts[0]) && typeof dateParts[0][0] === 'number' ? dateParts[0][0] : undefined
  if (!title && !year) return null
  return { title, year }
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
