import { describe, expect, it } from 'vitest'

import {
  createAiProposal,
  documentRevision,
  isProposalStale,
  proposalApplyTarget,
  proposalApplyRange,
  resolveProposal,
} from './proposals'

const original = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Početni tekst.' }] }],
}

describe('AI proposals', () => {
  it('marks a proposal stale when its target document changed', () => {
    const proposal = createAiProposal({
      sectionId: 'section-1',
      action: 'improve',
      baseContent: original,
      proposedText: 'Poboljšani tekst.',
      now: '2026-08-13T12:00:00.000Z',
    })
    const changed = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Korisnik je promijenio tekst.' }] }],
    }

    expect(proposal.baseRevision).toBe(documentRevision(original))
    expect(isProposalStale(proposal, changed)).toBe(true)
  })

  it('allows accepting a proposal only against its original revision', () => {
    const proposal = createAiProposal({
      sectionId: 'section-1',
      action: 'draft',
      baseContent: original,
      proposedText: 'Novi odlomak.',
      now: '2026-08-13T12:00:00.000Z',
    })

    expect(resolveProposal(proposal, 'accepted', original).status).toBe('accepted')
    expect(resolveProposal(proposal, 'accepted', { type: 'doc' }).status).toBe('stale')
  })

  it('uses the selection captured when the proposal was created', () => {
    const proposal = createAiProposal({
      sectionId: 'section-1',
      action: 'improve',
      baseContent: original,
      proposedText: 'Zamjena.',
      selectedFrom: 4,
      selectedTo: 12,
    })

    expect(proposalApplyRange(proposal, 'replace', original)).toEqual({ from: 4, to: 12 })
  })

  it('does not fall back to replacing the document when a selection proposal has no range', () => {
    const proposal = createAiProposal({
      sectionId: 'section-1',
      action: 'improve',
      baseContent: original,
      proposedText: 'Zamjena.',
    })

    expect(proposalApplyRange(proposal, 'replace', original)).toBeNull()
  })

  it('marks an invalid selection target unappliable instead of appending it elsewhere', () => {
    const proposal = createAiProposal({
      sectionId: 'section-1',
      action: 'improve',
      baseContent: original,
      proposedText: 'Zamjena.',
      selectedFrom: 12,
      selectedTo: 4,
    })

    expect(proposalApplyTarget(proposal, 'replace', original)).toBeNull()
  })

  it('uses append only for a proposal that was not selection-based', () => {
    const proposal = createAiProposal({
      sectionId: 'section-1',
      action: 'draft',
      baseContent: original,
      proposedText: 'Novi odlomak.',
    })

    expect(proposalApplyTarget(proposal, 'replace', original)).toEqual({ mode: 'append' })
  })
})
