import { describe, expect, it } from 'vitest'

import { createManuscript, plainTextDocument } from './model'
import { createAgenticDraft, upsertSectionRevision } from './agentic-revisions'
import { mergeVerifiedAgenticSections } from './agentic-merge'

function makeDraft() {
  const manuscript = createManuscript({ projectId: 'project-1', workType: 'z', now: '2026-08-14T10:00:00.000Z' })
  const draft = createAgenticDraft({ projectId: manuscript.projectId, runId: 'run-1', base: manuscript })
  return { manuscript, draft }
}

describe('mergeVerifiedAgenticSections', () => {
  it('accepts one verified section and preserves every other section', () => {
    const { manuscript, draft } = makeDraft()
    const section = manuscript.sections[0]
    const withRevision = upsertSectionRevision(draft, {
      sectionId: section.id,
      baseRevision: section.updatedAt,
      proposedContent: plainTextDocument('Verificirani uvod.'),
      status: 'verified',
      verificationMessage: 'U redu.',
      updatedAt: '2026-08-14T10:02:00.000Z',
    })

    const result = mergeVerifiedAgenticSections({ manuscript, draft: withRevision, sectionIds: [section.id] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.acceptedSectionIds).toEqual([section.id])
      expect(result.manuscript.sections[0].content).toEqual(withRevision.sections[0].proposedContent)
      expect(result.manuscript.sections[1].content).toEqual(manuscript.sections[1].content)
    }
  })

  it('accepts all verified sections but skips blocked and stale results', () => {
    const { manuscript, draft } = makeDraft()
    const [verified, blocked, stale] = manuscript.sections
    const withRevisions = [
      { sectionId: verified.id, baseRevision: verified.updatedAt, proposedContent: plainTextDocument('Provjereno.'), status: 'verified' as const, updatedAt: '2026-08-14T10:02:00.000Z' },
      { sectionId: blocked.id, baseRevision: blocked.updatedAt, proposedContent: plainTextDocument('Blokirano.'), status: 'blocked' as const, updatedAt: '2026-08-14T10:02:00.000Z' },
      { sectionId: stale.id, baseRevision: 'old-revision', proposedContent: plainTextDocument('Zastarjelo.'), status: 'verified' as const, updatedAt: '2026-08-14T10:02:00.000Z' },
    ].reduce((current, revision) => upsertSectionRevision(current, revision), draft)

    const result = mergeVerifiedAgenticSections({ manuscript, draft: withRevisions })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.acceptedSectionIds).toEqual([verified.id])
      expect(result.manuscript.sections[1].content).toEqual(blocked.content)
      expect(result.manuscript.sections[2].content).toEqual(stale.content)
    }
  })

  it('rejects a draft from another project or a missing section', () => {
    const { manuscript, draft } = makeDraft()
    expect(mergeVerifiedAgenticSections({ manuscript, draft: { ...draft, projectId: 'other-project' } })).toMatchObject({ ok: false })
    const missing = upsertSectionRevision(draft, { sectionId: 'missing', baseRevision: 'x', proposedContent: plainTextDocument('Nedostaje.'), status: 'verified', updatedAt: '2026-08-14T10:02:00.000Z' })
    expect(mergeVerifiedAgenticSections({ manuscript, draft: missing })).toMatchObject({ ok: false, error: expect.stringContaining('ne postoji') })
  })
})
