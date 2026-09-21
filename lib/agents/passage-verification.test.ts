import { describe, expect, it, vi } from 'vitest'

import { createGatewayPassageVerifier, executeBilledPassageVerification } from './passage-verification'

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
  it('settles passage verifier usage through the canonical billing lifecycle', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'katedra_reserve_request') return { data: { status: 'reserved' }, error: null }
      if (name === 'katedra_consume') return { data: { status: 'settled' }, error: null }
      if (name === 'katedra_release_request') return { data: { status: 'released' }, error: null }
      return { data: null, error: null }
    })
    const verifier = {
      verify: vi.fn(async () => ({ claims, provider: 'independent-verifier', model: 'verifier-model', usage: { inputTokens: 40, outputTokens: 12 }, outcome: 'verified' as const })),
    }

    const result = await executeBilledPassageVerification({ rpc }, {
      verifier,
      provider: 'independent-verifier',
      model: 'verifier-model',
      userId: 'user-1',
      projectId: 'project-1',
      runId: 'run-1',
      requestId: 'run-1:step-1:1:passage',
      agent: 'writing_verifier',
      attempt: 1,
      claims,
      citations,
    })

    expect(result).toMatchObject({ billingState: 'settled', usage: { inputTokens: 40, outputTokens: 12 }, charged: 100 })
    expect(rpc).toHaveBeenCalledWith('katedra_consume', expect.objectContaining({
      p_request_id: 'run-1:step-1:1:passage',
      p_project_id: 'project-1',
      p_in: 40,
      p_out: 12,
    }))
  })

  it('does not accept a passage result when verifier usage is unavailable', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'katedra_reserve_request') return { data: { status: 'reserved' }, error: null }
      if (name === 'katedra_mark_pending') return { data: { status: 'pending_reconciliation' }, error: null }
      return { data: { status: 'released' }, error: null }
    })
    const verifier = {
      verify: vi.fn(async () => ({ claims, provider: 'independent-verifier', model: 'verifier-model', outcome: 'needs_review' as const })),
    }

    await expect(executeBilledPassageVerification({ rpc }, {
      verifier,
      provider: 'independent-verifier',
      model: 'verifier-model',
      userId: 'user-1',
      projectId: 'project-1',
      runId: 'run-1',
      requestId: 'run-1:step-2:1:passage',
      agent: 'writing_verifier',
      attempt: 1,
      claims,
      citations,
    })).rejects.toMatchObject({ billingState: 'pending_reconciliation' })
    expect(rpc).toHaveBeenCalledWith('katedra_mark_pending', expect.objectContaining({ p_request_id: 'run-1:step-2:1:passage' }))
    expect(rpc).not.toHaveBeenCalledWith('katedra_consume', expect.anything())
  })

  it('attaches a verifier decision only to the exact original claim support', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body))
      expect(request.task).toBe('verify_claim_passages')
      expect(request.payload.claims[0].text).toContain('Digitalne usluge')
      expect(request.payload.claims[0].support[0].quote).toBe('Exact quote.')
      expect(JSON.stringify(request)).not.toContain('manuscript')
      expect(JSON.stringify(request)).not.toContain('output')
      return new Response(JSON.stringify({
        provider: 'independent-verifier',
        model: 'verifier-model',
        usage: { inputTokens: 120, outputTokens: 34 },
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
      provider: 'independent-verifier',
      fetchImpl,
      now: () => '2026-08-16T12:00:00.000Z',
    })

    await expect(verifier.verify({ projectId: 'project-1', runId: 'run-1', claims, citations })).resolves.toEqual({
      provider: 'independent-verifier',
      model: 'verifier-model',
      usage: { inputTokens: 120, outputTokens: 34 },
      outcome: 'verified',
      claims: [{
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
      }],
    })
  })

  it('fails closed when the gateway is unavailable or returns an unusable decision', async () => {
    const verifier = createGatewayPassageVerifier({
      endpoint: 'https://verifier.example.test/run',
      apiKey: 'secret',
      model: 'verifier-model',
      provider: 'independent-verifier',
      fetchImpl: vi.fn(async () => new Response('nope', { status: 503 })),
      now: () => '2026-08-16T12:00:00.000Z',
    })

    const result = await verifier.verify({ projectId: 'project-1', runId: 'run-1', claims, citations })
    expect(result.outcome).toBe('needs_review')
    expect(result.claims[0].support?.[0].verification).toMatchObject({
      status: 'needs_review',
      method: 'independent_gateway',
      checkedAt: '2026-08-16T12:00:00.000Z',
    })
  })
})
