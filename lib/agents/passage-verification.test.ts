import { describe, expect, it, vi } from 'vitest'

import { executionContextFixture, executionRecoveryFixture } from './execution-recovery.fixture'
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
  it('replays the original passage result despite a new citation verification timestamp', async () => {
    const fixture = executionRecoveryFixture()
    const verifier = { verify: vi.fn(async () => ({ claims, provider: 'fixture', model: 'fixture-model',
      usage: { inputTokens: 10, outputTokens: 5 }, outcome: 'verified' as const })) }
    const input = { verifier, provider: 'fixture', model: 'fixture-model', userId: 'user-1', projectId: 'project-1',
      runId: 'run-1', requestId: 'passage-replay', agent: 'writing_verifier', attempt: 1,
      execution: executionContextFixture, claims, citations }
    const first = await executeBilledPassageVerification(fixture.db, input)
    const second = await executeBilledPassageVerification(fixture.db, { ...input,
      citations: citations.map(citation => ({ ...citation, verification: {
        status: 'verified' as const, method: 'crossref' as const, checkedAt: '2026-09-08T20:00:00Z',
      } })) })
    expect(second).toEqual(first)
    expect(verifier.verify).toHaveBeenCalledTimes(1)
    expect(fixture.debitCount()).toBe(1)
  })
  it('settles passage verifier usage through the canonical billing lifecycle', async () => {
    const { db, rpc } = executionRecoveryFixture()
    const verifier = {
      verify: vi.fn(async () => ({ claims, provider: 'independent-verifier', model: 'verifier-model', usage: { inputTokens: 40, outputTokens: 12 }, outcome: 'verified' as const })),
    }

    const result = await executeBilledPassageVerification(db, {
      execution: executionContextFixture,
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
    expect(rpc).toHaveBeenCalledWith('record_agent_provider_response', expect.objectContaining({ p_evidence: expect.objectContaining({ inputTokens: 40, outputTokens: 12, charged: 100 }) }))
  })

  it('does not accept a passage result when verifier usage is unavailable', async () => {
    const { db, rpc } = executionRecoveryFixture()
    const verifier = {
      verify: vi.fn(async () => ({ claims, provider: 'independent-verifier', model: 'verifier-model', outcome: 'needs_review' as const })),
    }

    await expect(executeBilledPassageVerification(db, {
      execution: executionContextFixture,
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
    expect(rpc).toHaveBeenCalledWith('record_agent_provider_response', expect.objectContaining({ p_evidence: expect.objectContaining({ inputTokens: null, outputTokens: null, charged: null }) }))
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
