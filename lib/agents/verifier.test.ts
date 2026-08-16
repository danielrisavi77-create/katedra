import { describe, expect, it } from 'vitest'

import { verifyAgentResult, verifierForAgent } from './verifier'

describe('agent verifier', () => {
  it('routes every agent through its own verifier function', () => {
    const verifiers = ['intake', 'sources', 'structure', 'planning', 'writing', 'citation', 'review', 'export'].map(verifierForAgent)

    expect(new Set(verifiers).size).toBe(8)
    expect(verifierForAgent('writing')({
      agent: 'writing',
      output: 'Tekst bez dokaza.',
      citations: [],
    })).toMatchObject({ status: 'blocked' })
    expect(verifierForAgent('structure')({
      agent: 'structure',
      output: 'Plan strukture.',
      citations: [],
    })).toMatchObject({ status: 'verified' })
  })

  it('blocks a result containing factual claims without verified evidence', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Prema istraživanju, 80% studenata koristi AI.',
      citations: [],
    })).toMatchObject({ status: 'blocked' })
  })

  it('requests a bounded repair when an agent returns empty output', () => {
    expect(verifyAgentResult({
      agent: 'planning',
      output: '',
      citations: [],
    })).toMatchObject({
      status: 'needs_revision',
      issues: [{ code: 'invalid_output' }],
    })
  })

  it('accepts a result when every factual claim has verified evidence', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Ovo je argument koji proizlazi iz izvora.',
      claims: [{ id: 'claim-1', text: 'Ovo je argument koji proizlazi iz izvora.', citationIds: ['source-1'] }],
      citations: [{ id: 'source-1', url: 'https://example.test/source', verified: true }],
    }, { requireIndependentSourceVerification: false })).toMatchObject({ status: 'verified', issues: [] })
  })

  it('fails closed when a citation only claims verified without independent metadata', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Tvrdnja s oznakom izvora.',
      claims: [{ id: 'claim-1', text: 'Tvrdnja s oznakom izvora.', citationIds: ['source-1'] }],
      citations: [{ id: 'source-1', url: 'https://example.test/source', verified: true }],
    })).toMatchObject({
      status: 'blocked',
      issues: [{ code: 'unverified_source' }],
    })
  })

  it('requires independent source verification for agentic citation-bound results', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Tvrdnja s legacy oznakom izvora.',
      claims: [{ id: 'claim-1', text: 'Tvrdnja s legacy oznakom izvora.', citationIds: ['source-1'] }],
      citations: [{ id: 'source-1', url: 'https://example.test/source', verified: true }],
    }, { requireIndependentSourceVerification: true })).toMatchObject({
      status: 'blocked',
      issues: [{ code: 'unverified_source' }],
    })
  })

  it('requires a source passage before an independently verified citation-bound result can pass', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Tvrdnja s identificiranim izvorom.',
      claims: [{ id: 'claim-1', text: 'Tvrdnja s identificiranim izvorom.', citationIds: ['source-1'] }],
      citations: [{ id: 'source-1', doi: '10.1234/example', verified: true, verification: {
        status: 'verified', method: 'crossref', checkedAt: '2026-08-16T10:00:00.000Z',
      } }],
    }, { requireIndependentSourceVerification: true })).toMatchObject({
      status: 'needs_revision',
      issues: [{ code: 'missing_passage_evidence' }],
    })
  })

  it('passes the strict source gate when a claim has a reviewable source passage', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Tvrdnja s vezanim odlomkom.',
      claims: [{
        id: 'claim-1',
        text: 'Tvrdnja s vezanim odlomkom.',
        citationIds: ['source-1'],
        support: [{ citationId: 'source-1', quote: 'Relevantan odlomak.', locator: 'p. 4' }],
      }],
      citations: [{ id: 'source-1', doi: '10.1234/example', verified: true, verification: {
        status: 'verified', method: 'crossref', checkedAt: '2026-08-16T10:00:00.000Z',
      } }],
    }, { requireIndependentSourceVerification: true })).toMatchObject({ status: 'verified' })
  })

  it('does not treat a merely supplied passage as independently verified', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Tvrdnja s odlomkom koji još nije provjeren.',
      claims: [{
        id: 'claim-1',
        text: 'Tvrdnja s odlomkom koji još nije provjeren.',
        citationIds: ['source-1'],
        support: [{
          citationId: 'source-1',
          quote: 'Odlomak koji treba provjeru.',
          locator: 'p. 4',
          verification: { status: 'needs_review', method: 'independent_gateway', checkedAt: '2026-08-16T10:00:00.000Z' },
        }],
      }],
      citations: [{ id: 'source-1', doi: '10.1234/example', verified: true, verification: {
        status: 'verified', method: 'crossref', checkedAt: '2026-08-16T10:00:00.000Z',
      } }],
    }, { requireIndependentSourceVerification: true, requireIndependentPassageVerification: true })).toMatchObject({
      status: 'needs_revision',
      issues: [{ code: 'unverified_passage_evidence' }],
    })
  })

  it('accepts a passage only when the independent passage verifier marks it supported', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Tvrdnja s neovisno provjerenim odlomkom.',
      claims: [{
        id: 'claim-1',
        text: 'Tvrdnja s neovisno provjerenim odlomkom.',
        citationIds: ['source-1'],
        support: [{
          citationId: 'source-1',
          quote: 'Odlomak koji podržava tvrdnju.',
          locator: 'p. 4',
          verification: { status: 'verified', method: 'independent_gateway', checkedAt: '2026-08-16T10:00:00.000Z', claimSupported: 'supported' },
        }],
      }],
      citations: [{ id: 'source-1', doi: '10.1234/example', verified: true, verification: {
        status: 'verified', method: 'crossref', checkedAt: '2026-08-16T10:00:00.000Z',
      } }],
    }, { requireIndependentSourceVerification: true, requireIndependentPassageVerification: true })).toMatchObject({ status: 'verified' })
  })

  it('blocks citation-required results when claim-to-source evidence is missing', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Tekst ima izvor, ali nema dokaznu mapu tvrdnji.',
      citations: [{ id: 'source-1', url: 'https://example.test/source', verified: true }],
    })).toMatchObject({
      status: 'blocked',
      issues: [{ code: 'missing_claim_evidence' }],
    })
  })

  it('does not treat an empty claim map as verified evidence for citation-bound output', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Tekst s mogućom činjeničnom tvrdnjom.',
      claims: [],
      citations: [{ id: 'source-1', url: 'https://example.test/source', verified: true }],
    })).toMatchObject({
      status: 'blocked',
      issues: [{ code: 'missing_claim_evidence' }],
    })
  })

  it('returns needs_revision for missing bibliographic metadata', () => {
    expect(verifyAgentResult({
      agent: 'sources',
      output: 'Izvor za daljnju provjeru.',
      citations: [{ id: 'source-1', verified: true }],
    })).toMatchObject({ status: 'needs_revision' })
  })

  it('does not treat an unsafe locator as verified source evidence', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Tvrdnja s nesigurnim lokatorom.',
      claims: [{ id: 'claim-1', text: 'Tvrdnja s nesigurnim lokatorom.', citationIds: ['source-1'] }],
      citations: [{ id: 'source-1', url: 'javascript:alert(1)', verified: true }],
    })).toMatchObject({ status: 'needs_revision', issues: [{ code: 'incomplete_source' }] })
  })

  it('does not require citations for structural planning results', () => {
    expect(verifyAgentResult({
      agent: 'structure',
      output: 'Uvod, metodologija, analiza i zaključak.',
      citations: [],
    })).toMatchObject({ status: 'verified', issues: [] })
  })

  it('blocks a factual claim that is not mapped to verified evidence', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Tvrdnja bez dokaza.',
      claims: [{ id: 'claim-1', text: 'Tvrdnja bez dokaza.', citationIds: [] }],
      citations: [{ id: 'source-1', url: 'https://example.test', verified: true }],
    })).toMatchObject({ status: 'blocked', issues: [{ code: 'missing_claim_evidence' }] })
  })
})
