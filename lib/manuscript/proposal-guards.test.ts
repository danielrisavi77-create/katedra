import { describe, expect, it } from 'vitest'

import { createManuscript } from './model'
import { createAiProposal } from './proposals'
import { canApplyProposal, isCurrentAiRequest } from './proposal-guards'

describe('manuscript proposal guards', () => {
  it('rejects a ready proposal that belongs to another section', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })
    const proposal = createAiProposal({
      sectionId: manuscript.sections[0].id,
      action: 'draft',
      baseContent: manuscript.sections[0].content,
      proposedText: 'Prijedlog',
    })

    expect(canApplyProposal(proposal, manuscript.sections[1].id, manuscript.sections[1].content)).toEqual({
      ok: false,
      reason: 'section_mismatch',
    })
  })

  it('rejects a proposal after the current section content changed', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })
    const proposal = createAiProposal({
      sectionId: manuscript.sections[0].id,
      action: 'draft',
      baseContent: manuscript.sections[0].content,
      proposedText: 'Prijedlog',
    })
    const changed = { type: 'doc' as const, content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Novi tekst' }] }] }

    expect(canApplyProposal(proposal, manuscript.sections[0].id, changed)).toEqual({
      ok: false,
      reason: 'stale',
    })
  })

  it('accepts only the latest request for the same section', () => {
    expect(isCurrentAiRequest('request-2', 'request-2', 'section-1', 'section-1')).toBe(true)
    expect(isCurrentAiRequest('request-1', 'request-2', 'section-1', 'section-1')).toBe(false)
    expect(isCurrentAiRequest('request-2', 'request-2', 'section-1', 'section-2')).toBe(false)
    expect(isCurrentAiRequest(null, 'request-2', 'section-1', 'section-1')).toBe(false)
  })
})
