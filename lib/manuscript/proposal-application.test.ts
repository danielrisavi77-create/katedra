import { describe, expect, it, vi } from 'vitest'
import { prepareProposalApplication } from './proposal-application'
import { createAiProposal } from './proposals'
import { createManuscript, plainTextDocument } from './model'

function fixture() {
  const manuscript = createManuscript({ projectId: 'project-1', title: 'Test', workType: 's' })
  const section = manuscript.sections[0]
  section.content = plainTextDocument('Original')
  const proposal = createAiProposal({ sectionId: section.id, action: 'revise', baseContent: section.content, proposedText: 'Proposed', now: '2026-09-07T12:00:00Z' })
  return { manuscript, proposal }
}

describe('proposal snapshot application', () => {
  it.each(['edit', 'navigation', 'proposal', 'project'])('rejects %s changes while snapshot persistence is pending', async (change) => {
    const initial = fixture()
    let current = initial
    let complete!: () => void
    const snapshot = vi.fn(() => new Promise<void>(resolve => { complete = resolve }))
    const pending = prepareProposalApplication({ ...initial, mode: 'append', snapshot, readCurrent: () => current })
    if (change === 'edit') current = { ...initial, manuscript: { ...initial.manuscript, sections: initial.manuscript.sections.map(section => ({ ...section, content: plainTextDocument('New user text') })) } }
    if (change === 'navigation') current = { ...initial, manuscript: { ...initial.manuscript, activeSectionId: 'different-section' } }
    if (change === 'proposal') current = { ...initial, proposal: { ...initial.proposal, proposedText: 'New proposal text' } }
    if (change === 'project') current = { ...initial, manuscript: { ...initial.manuscript, projectId: 'different-project' } }
    complete()
    await expect(pending).resolves.toBeNull()
  })

  it('returns the exact expected content only after snapshot success', async () => {
    const initial = fixture()
    const snapshot = vi.fn(async () => {})
    await expect(prepareProposalApplication({ ...initial, mode: 'append', snapshot, readCurrent: () => initial })).resolves.toMatchObject({
      id: initial.proposal.id, sectionId: initial.proposal.sectionId, text: 'Proposed', expectedContent: initial.manuscript.sections[0].content,
    })
    expect(snapshot).toHaveBeenCalledOnce()
  })
})
