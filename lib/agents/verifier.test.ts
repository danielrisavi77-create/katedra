import { describe, expect, it } from 'vitest'

import { verifyAgentResult } from './verifier'

describe('agent verifier', () => {
  it('blocks a result containing factual claims without verified evidence', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Prema istraživanju, 80% studenata koristi AI.',
      citations: [],
    })).toMatchObject({ status: 'blocked' })
  })

  it('accepts a result when every factual claim has verified evidence', () => {
    expect(verifyAgentResult({
      agent: 'writing',
      output: 'Ovo je argument koji proizlazi iz izvora.',
      claims: [{ id: 'claim-1', text: 'Ovo je argument koji proizlazi iz izvora.', citationIds: ['source-1'] }],
      citations: [{ id: 'source-1', url: 'https://example.test/source', verified: true }],
    })).toMatchObject({ status: 'verified', issues: [] })
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

  it('returns needs_revision for missing bibliographic metadata', () => {
    expect(verifyAgentResult({
      agent: 'sources',
      output: 'Izvor za daljnju provjeru.',
      citations: [{ id: 'source-1', verified: true }],
    })).toMatchObject({ status: 'needs_revision' })
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
