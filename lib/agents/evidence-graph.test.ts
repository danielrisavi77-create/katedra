import { describe, expect, it } from 'vitest'

import { buildEvidenceGraph } from './evidence-graph'

describe('evidence graph', () => {
  it('distinguishes verified source identity from missing passage support', () => {
    const graph = buildEvidenceGraph({
      claims: [{ id: 'claim-1', text: 'Tvrdnja.', citationIds: ['source-1'] }],
      citations: [{ id: 'source-1', doi: '10.1234/example', verified: true, verification: {
        status: 'verified', method: 'crossref', checkedAt: '2026-08-16T10:00:00.000Z',
      } }],
    }, { requireIndependentSourceVerification: true })

    expect(graph.status).toBe('needs_passage')
    expect(graph.claims[0]).toMatchObject({ claimId: 'claim-1', status: 'needs_passage' })
  })

  it('attaches a bounded passage to the correct citation without calling entailment verified', () => {
    const graph = buildEvidenceGraph({
      claims: [{
        id: 'claim-1',
        text: 'Tvrdnja.',
        citationIds: ['source-1'],
        support: [{ citationId: 'source-1', quote: 'Kratak odlomak iz izvora.', locator: 'p. 4' }],
      }],
      citations: [{ id: 'source-1', url: 'https://example.test/source', verified: true, verification: {
        status: 'verified', method: 'url_fetch', checkedAt: '2026-08-16T10:00:00.000Z',
      } }],
    }, { requireIndependentSourceVerification: true })

    expect(graph.status).toBe('ready_for_review')
    expect(graph.claims[0]).toMatchObject({ claimId: 'claim-1', status: 'ready_for_review' })
    expect(graph.claims[0].support).toEqual([{ citationId: 'source-1', quote: 'Kratak odlomak iz izvora.', locator: 'p. 4' }])
  })

  it('blocks support that points to a source outside the claim map', () => {
    const graph = buildEvidenceGraph({
      claims: [{
        id: 'claim-1',
        text: 'Tvrdnja.',
        citationIds: ['source-1'],
        support: [{ citationId: 'source-2', quote: 'Pogrešan izvor.' }],
      }],
      citations: [{ id: 'source-1', url: 'https://example.test/source', verified: true }],
    })

    expect(graph.status).toBe('blocked')
    expect(graph.claims[0]).toMatchObject({ claimId: 'claim-1', status: 'blocked' })
  })
})
