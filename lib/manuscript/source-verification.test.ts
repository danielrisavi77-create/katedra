import { describe, expect, it, vi } from 'vitest'

import { verifyManuscriptSource } from './source-verification'
import type { ManuscriptSourceV1 } from './types'

describe('manuscript source verification', () => {
  it('stores independent Crossref evidence for a matching DOI', async () => {
    const source: ManuscriptSourceV1 = {
      id: 'source-1',
      title: 'Matching title',
      authors: 'Jane Doe',
      year: '2024',
      urlOrDoi: '10.1000/example',
      verified: false,
    }
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      message: {
        title: ['Matching title'],
        author: [{ given: 'Jane', family: 'Doe' }],
        published: { 'date-parts': [[2024]] },
      },
    }), { status: 200 }))

    await expect(verifyManuscriptSource(source, { fetchImpl, now: () => '2026-08-22T10:00:00.000Z' })).resolves.toMatchObject({
      verified: true,
      verification: {
        status: 'verified',
        method: 'crossref',
        checkedAt: '2026-08-22T10:00:00.000Z',
      },
    })
  })

  it('keeps a URL source visible as needs review instead of claiming verification', async () => {
    const source: ManuscriptSourceV1 = {
      id: 'source-2',
      title: 'Web source',
      urlOrDoi: 'https://example.test/source',
      verified: true,
    }

    await expect(verifyManuscriptSource(source, { fetchImpl: vi.fn(), now: () => '2026-08-22T10:00:00.000Z' })).resolves.toMatchObject({
      verified: false,
      verification: { status: 'needs_review', method: 'url_fetch' },
    })
  })
})
