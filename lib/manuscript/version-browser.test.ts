import { describe, expect, it } from 'vitest'

import { createManuscript, plainTextDocument } from './model'
import { changeKindLabel, compareManuscripts, inferChangeKind, restoreTargetManuscript } from './version-browser'

describe('manuscript version browser', () => {
  it('infers and labels human-readable change kinds', () => {
    expect(inferChangeKind('AI prijedlog: skrati')).toBe('ai_proposal')
    expect(changeKindLabel('mentor_review')).toBe('Mentorova revizija')
    expect(inferChangeKind('Uvoz teksta: rad.txt')).toBe('import')
  })

  it('compares section text and metadata without exposing the whole document as a server payload', () => {
    const before = createManuscript({ projectId: 'p', workType: 's', title: 'Rad' })
    const after = { ...before, meta: { ...before.meta, mentor: 'Mentor' }, sections: before.sections.map((section, index) => index === 0 ? { ...section, content: plainTextDocument('Nova teza') } : section) }
    const diff = compareManuscripts(before, after)
    expect(diff.metadataChanged).toBe(true)
    expect(diff.changedSections).toBe(1)
    expect(diff.sections[0].beforeText).toBe('')
    expect(diff.sections[0].afterText).toBe('Nova teza')
  })

  it('returns either the before or after manuscript for an explicit restore target', () => {
    const before = createManuscript({ projectId: 'p', workType: 's', title: 'Prije' })
    const after = { ...before, title: 'Poslije' }
    const snapshot = { id: 'snapshot', projectId: 'p', reason: 'KorisniÄŤka promjena', createdAt: before.updatedAt, manuscript: before, after }

    expect(restoreTargetManuscript(snapshot, 'before')).toBe(before)
    expect(restoreTargetManuscript(snapshot, 'after')).toBe(after)
    expect(restoreTargetManuscript({ ...snapshot, after: undefined }, 'after')).toBe(before)
  })
})
