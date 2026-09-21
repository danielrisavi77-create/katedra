import { describe, expect, it, vi } from 'vitest'

import { createIndependentCitationVerifier } from './source-verification'

describe('independent citation verification', () => {
  it('verifies a DOI only after registry metadata matches', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      message: {
        title: ['Matching title'],
        author: [{ given: 'Jane', family: 'Doe' }],
        published: { 'date-parts': [[2024]] },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const verifier = createIndependentCitationVerifier({ fetchImpl, now: () => '2026-08-16T12:00:00.000Z' })

    await expect(verifier.verify([{ id: 'doi-1', title: 'Matching title', authors: 'Jane Doe', year: 2024, doi: '10.1000/example', verified: false }])).resolves.toEqual([
      expect.objectContaining({
        id: 'doi-1',
        verified: true,
        verification: expect.objectContaining({ status: 'verified', method: 'crossref', titleMatch: true, authorMatch: true, yearMatch: true }),
      }),
    ])
    expect(fetchImpl).toHaveBeenCalledWith('https://api.crossref.org/works/10.1000%2Fexample', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('canonicalizes a DOI URL before returning verified citation evidence', async () => {
    const verifier = createIndependentCitationVerifier({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({
        message: { title: ['Matching title'], published: { 'date-parts': [[2024]] } },
      }), { status: 200 })),
    })

    await expect(verifier.verify([{ id: 'doi-url', title: 'Matching title', year: 2024, doi: 'https://doi.org/10.1000/example', verified: false }])).resolves.toEqual([
      expect.objectContaining({
        doi: '10.1000/example',
        verified: true,
        verification: expect.objectContaining({ status: 'verified' }),
      }),
    ])
  })

  it('accepts the common doi: prefix as the same canonical DOI locator', async () => {
    const verifier = createIndependentCitationVerifier({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ message: { title: ['Matching title'] } }), { status: 200 })),
    })

    await expect(verifier.verify([{ id: 'doi-prefix', title: 'Matching title', doi: 'doi:10.1000/example', verified: false }])).resolves.toEqual([
      expect.objectContaining({ doi: '10.1000/example', verified: true }),
    ])
  })

  it('does not trust a mismatching DOI title', async () => {
    const verifier = createIndependentCitationVerifier({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ message: { title: ['Different title'] } }), { status: 200 })),
    })

    await expect(verifier.verify([{ id: 'doi-1', title: 'Expected title', doi: '10.1000/example', verified: true }])).resolves.toEqual([
      expect.objectContaining({ verified: false, verification: expect.objectContaining({ status: 'needs_review', titleMatch: false }) }),
    ])
  })

  it('does not verify a DOI when cited authors do not match registry metadata', async () => {
    const verifier = createIndependentCitationVerifier({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ message: {
        title: ['Matching title'],
        author: [{ given: 'Jane', family: 'Doe' }],
        published: { 'date-parts': [[2024]] },
      } }), { status: 200 })),
    })

    await expect(verifier.verify([{ id: 'doi-author', title: 'Matching title', authors: 'Mark Smith', year: 2024, doi: '10.1000/example', verified: false }])).resolves.toEqual([
      expect.objectContaining({ verified: false, verification: expect.objectContaining({ status: 'needs_review', authorMatch: false }) }),
    ])
  })

  it('does not verify a cited year when the registry omits the year', async () => {
    const verifier = createIndependentCitationVerifier({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ message: { title: ['Matching title'] } }), { status: 200 })),
    })

    await expect(verifier.verify([{ id: 'doi-year', title: 'Matching title', year: 2024, doi: '10.1000/example', verified: false }])).resolves.toEqual([
      expect.objectContaining({ verified: false, verification: expect.objectContaining({ status: 'needs_review', yearMatch: false }) }),
    ])
  })

  it('blocks a DOI that Crossref marks as retracted', async () => {
    const verifier = createIndependentCitationVerifier({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ message: {
        title: ['Matching title'],
        published: { 'date-parts': [[2024]] },
        relation: { 'is-retracted-by': [{ id: '10.1000/retraction' }] },
      } }), { status: 200 })),
    })

    await expect(verifier.verify([{ id: 'doi-retracted', title: 'Matching title', year: 2024, doi: '10.1000/example', verified: false }])).resolves.toEqual([
      expect.objectContaining({
        verified: false,
        verification: expect.objectContaining({ status: 'blocked', retracted: true }),
      }),
    ])
  })

  it('keeps a URL in review without server-side fetching user-controlled hosts', async () => {
    const fetchImpl = vi.fn()
    const verifier = createIndependentCitationVerifier({ fetchImpl })

    await expect(verifier.verify([{ id: 'url-1', url: 'https://example.test/source', verified: true }])).resolves.toEqual([
      expect.objectContaining({ verified: false, verification: expect.objectContaining({ status: 'needs_review', method: 'url_fetch' }) }),
    ])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('blocks a citation without a safe DOI or URL', async () => {
    const verifier = createIndependentCitationVerifier({ fetchImpl: vi.fn() })

    await expect(verifier.verify([{ id: 'bad-1', url: 'javascript:alert(1)', verified: true }])).resolves.toEqual([
      expect.objectContaining({ verified: false, verification: expect.objectContaining({ status: 'blocked' }) }),
    ])
  })

  it('limits concurrent registry checks for a large citation batch', async () => {
    let active = 0
    let peak = 0
    const fetchImpl = vi.fn(async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 2))
      active -= 1
      return new Response(JSON.stringify({ message: { title: ['Matching title'] } }), { status: 200 })
    })
    const verifier = createIndependentCitationVerifier({ fetchImpl })
    const citations = Array.from({ length: 12 }, (_, index) => ({
      id: `doi-${index}`,
      title: 'Matching title',
      doi: `10.1000/example-${index}`,
      verified: false,
    }))

    await expect(verifier.verify(citations)).resolves.toHaveLength(citations.length)
    expect(peak).toBeLessThanOrEqual(4)
  })

  it('deduplicates registry checks for repeated DOI evidence', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: { title: ['Matching title'] } }), { status: 200 }))
    const verifier = createIndependentCitationVerifier({ fetchImpl })
    const citations = [
      { id: 'claim-a', title: 'Matching title', doi: '10.1000/example', verified: false },
      { id: 'claim-b', title: 'Matching title', doi: 'doi:10.1000/example', verified: false },
    ]

    const results = await verifier.verify(citations)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(results).toHaveLength(2)
    expect(results.every((citation) => citation.verified)).toBe(true)
  })
})
