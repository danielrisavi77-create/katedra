import { describe, expect, it, vi } from 'vitest'

import { createIndependentCitationVerifier } from './source-verification'

describe('independent citation verification', () => {
  it('verifies a DOI only after registry metadata matches', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      message: {
        title: ['Matching title'],
        published: { 'date-parts': [[2024]] },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const verifier = createIndependentCitationVerifier({ fetchImpl, now: () => '2026-08-16T12:00:00.000Z' })

    await expect(verifier.verify([{ id: 'doi-1', title: 'Matching title', year: 2024, doi: '10.1000/example', verified: false }])).resolves.toEqual([
      expect.objectContaining({
        id: 'doi-1',
        verified: true,
        verification: expect.objectContaining({ status: 'verified', method: 'crossref', titleMatch: true, yearMatch: true }),
      }),
    ])
    expect(fetchImpl).toHaveBeenCalledWith('https://api.crossref.org/works/10.1000%2Fexample', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('does not trust a mismatching DOI title', async () => {
    const verifier = createIndependentCitationVerifier({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ message: { title: ['Different title'] } }), { status: 200 })),
    })

    await expect(verifier.verify([{ id: 'doi-1', title: 'Expected title', doi: '10.1000/example', verified: true }])).resolves.toEqual([
      expect.objectContaining({ verified: false, verification: expect.objectContaining({ status: 'needs_review', titleMatch: false }) }),
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
})
