import { describe, expect, it, vi } from 'vitest'

import { createGatewayPassageVerifier } from './passage-verification'

const claims = [{
  id: 'claim-1',
  text: 'Digitalne usluge mijenjaju odnos građana i institucija.',
  citationIds: ['source-1'],
  support: [{ citationId: 'source-1', quote: 'Exact quote.', locator: 'p. 4' }],
}]

const citations = [{
  id: 'source-1',
  title: 'Digitalna uprava',
  authors: 'Jane Doe',
  year: 2024,
  doi: '10.1000/example',
  verified: true,
}]

describe('gateway passage verification', () => {
  it('attaches a verifier decision only to the exact original claim support', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body))
      expect(request.task).toBe('verify_claim_passages')
      expect(request.payload.claims[0].text).toContain('Digitalne usluge')
      expect(request.payload.claims[0].support[0].quote).toBe('Exact quote.')
      expect(JSON.stringify(request)).not.toContain('manuscript')
      expect(JSON.stringify(request)).not.toContain('output')
      return new Response(JSON.stringify({
        decisions: [
          { claimId: 'claim-1', citationId: 'source-1', quote: 'Exact quote.', locator: 'p. 4', status: 'verified', claimSupported: 'supported', confidence: 0.92, evidenceUrl: 'https://source.example/p/4' },
          { claimId: 'claim-1', citationId: 'source-1', quote: 'Injected quote.', locator: 'p. 9', status: 'verified', claimSupported: 'supported' },
        ],
      }), { status: 200 })
    })
    const verifier = createGatewayPassageVerifier({
      endpoint: 'https://verifier.example.test/run',
      apiKey: 'secret',
      model: 'verifier-model',
      fetchImpl,
      now: () => '2026-08-16T12:00:00.000Z',
    })

    await expect(verifier.verify({ projectId: 'project-1', runId: 'run-1', claims, citations })).resolves.toEqual([{
      ...claims[0],
      support: [{
        citationId: 'source-1',
        quote: 'Exact quote.',
        locator: 'p. 4',
        verification: {
          status: 'verified',
          method: 'independent_gateway',
          checkedAt: '2026-08-16T12:00:00.000Z',
          claimSupported: 'supported',
          confidence: 0.92,
          evidenceUrl: 'https://source.example/p/4',
        },
      }],
    }])
  })

  it('fails closed when the gateway is unavailable or returns an unusable decision', async () => {
    const verifier = createGatewayPassageVerifier({
      endpoint: 'https://verifier.example.test/run',
      apiKey: 'secret',
      model: 'verifier-model',
      fetchImpl: vi.fn(async () => new Response('nope', { status: 503 })),
      now: () => '2026-08-16T12:00:00.000Z',
    })

    const result = await verifier.verify({ projectId: 'project-1', runId: 'run-1', claims, citations })
    expect(result[0].support?.[0].verification).toMatchObject({
      status: 'needs_review',
      method: 'independent_gateway',
      checkedAt: '2026-08-16T12:00:00.000Z',
    })
  })
})
