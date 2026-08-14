import { describe, expect, it } from 'vitest'

import { createManuscript, plainTextDocument } from './model'
import {
  acceptVerifiedSections,
  createAgenticDraft,
  markStaleRevisions,
  upsertSectionRevision,
  validateAgenticDraft,
} from './agentic-revisions'

function manuscript() {
  return createManuscript({
    projectId: 'project-1',
    title: 'Digitalna javna uprava',
    workType: 'z',
    now: '2026-08-14T10:00:00.000Z',
  })
}

describe('agentic manuscript revisions', () => {
  it('creates a draft anchored to the current manuscript', () => {
    const base = manuscript()
    const draft = createAgenticDraft({ projectId: base.projectId, runId: 'run-1', base, now: '2026-08-14T10:01:00.000Z' })

    expect(draft).toMatchObject({
      schemaVersion: 1,
      projectId: 'project-1',
      runId: 'run-1',
      baseManuscriptUpdatedAt: base.updatedAt,
      contextRevision: expect.any(String),
      sections: [],
      createdAt: '2026-08-14T10:01:00.000Z',
    })
    expect(validateAgenticDraft(draft)).toEqual({ ok: true, errors: [] })
  })

  it('upserts one revision per section without mutating the draft', () => {
    const base = manuscript()
    const draft = createAgenticDraft({ projectId: base.projectId, runId: 'run-1', base })
    const section = base.sections[0]
    const revision = {
      sectionId: section.id,
      baseRevision: section.updatedAt,
      proposedContent: plainTextDocument('Provjereni nacrt uvoda.'),
      status: 'verified' as const,
      verificationMessage: 'Sadržaj ima provjerene izvore.',
      updatedAt: '2026-08-14T10:02:00.000Z',
    }

    const next = upsertSectionRevision(draft, revision)
    expect(draft.sections).toHaveLength(0)
    expect(next.sections).toEqual([revision])
    expect(upsertSectionRevision(next, { ...revision, status: 'stale' }).sections).toHaveLength(1)
  })

  it('marks a revision stale when its base section changed', () => {
    const base = manuscript()
    const section = base.sections[0]
    const draft = upsertSectionRevision(
      createAgenticDraft({ projectId: base.projectId, runId: 'run-1', base }),
      {
        sectionId: section.id,
        baseRevision: section.updatedAt,
        proposedContent: plainTextDocument('Nacrt koji više nije aktualan.'),
        status: 'verified',
        updatedAt: '2026-08-14T10:02:00.000Z',
      },
    )
    const changed = {
      ...base,
      updatedAt: '2026-08-14T10:03:00.000Z',
      sections: base.sections.map((item) => item.id === section.id
        ? { ...item, updatedAt: '2026-08-14T10:03:00.000Z' }
        : item),
    }

    expect(markStaleRevisions(draft, changed).sections[0].status).toBe('stale')
  })

  it('accepts only verified sections and leaves other sections untouched', () => {
    const base = manuscript()
    const [first, second] = base.sections
    const draft = [
      {
        sectionId: first.id,
        baseRevision: first.updatedAt,
        proposedContent: plainTextDocument('Prihvaćeni tekst.'),
        status: 'verified' as const,
        updatedAt: '2026-08-14T10:02:00.000Z',
      },
      {
        sectionId: second.id,
        baseRevision: second.updatedAt,
        proposedContent: plainTextDocument('Blokirani tekst.'),
        status: 'blocked' as const,
        updatedAt: '2026-08-14T10:02:00.000Z',
      },
    ].reduce((current, revision) => upsertSectionRevision(current, revision), createAgenticDraft({
      projectId: base.projectId,
      runId: 'run-1',
      base,
    }))

    const accepted = acceptVerifiedSections(base, draft)
    expect(accepted.sections[0].content).toEqual(draft.sections[0].proposedContent)
    expect(accepted.sections[1].content).toEqual(second.content)
    expect(accepted.updatedAt).not.toBe(base.updatedAt)
  })

  it('supports accepting a selected section only', () => {
    const base = manuscript()
    const [first, second] = base.sections
    const draft = [first, second].reduce((current, section) => upsertSectionRevision(current, {
      sectionId: section.id,
      baseRevision: section.updatedAt,
      proposedContent: plainTextDocument(`Tekst za ${section.title}.`),
      status: 'verified',
      updatedAt: '2026-08-14T10:02:00.000Z',
    }), createAgenticDraft({ projectId: base.projectId, runId: 'run-1', base }))

    const accepted = acceptVerifiedSections(base, draft, [second.id])
    expect(accepted.sections[0].content).toEqual(first.content)
    expect(accepted.sections[1].content).toEqual(draft.sections[1].proposedContent)
  })

  it('rejects malformed drafts instead of allowing unsafe merges', () => {
    const result = validateAgenticDraft({
      schemaVersion: 2,
      projectId: '',
      runId: '',
      baseManuscriptUpdatedAt: 'not-a-date',
      contextRevision: '',
      sections: [{
        sectionId: '',
        baseRevision: '',
        proposedContent: { type: 'unknown' },
        status: 'verified',
        updatedAt: 'not-a-date',
      }],
      createdAt: 'not-a-date',
      updatedAt: 'not-a-date',
    })

    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(3)
  })
})
