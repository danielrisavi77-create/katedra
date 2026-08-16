import { describe, expect, it } from 'vitest'

import { addManuscriptBranch, createManuscriptBranch, createManuscriptV2 } from './versions'
import type { ManuscriptV1 } from './types'

const manuscript: ManuscriptV1 = {
  schemaVersion: 1,
  projectId: 'project-1',
  title: 'Rad',
  workType: 'z',
  activeSectionId: 'intro',
  sections: [{ id: 'intro', title: 'Uvod', kind: 'chapter', order: 0, status: 'draft', content: { type: 'doc', content: [] }, updatedAt: '2026-08-14T00:00:00.000Z' }],
  sources: [],
  meta: {},
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
}

describe('manuscript v2 versions', () => {
  it('creates a v2 envelope without changing the canonical manuscript content', () => {
    const v2 = createManuscriptV2(manuscript, { revisionId: 'rev-1' })
    expect(v2).toMatchObject({ schemaVersion: 2, revisionId: 'rev-1', projectId: 'project-1', branches: [] })
    expect(v2.sections).toEqual(manuscript.sections)
  })

  it('keeps at most twenty local branches and preserves run provenance', () => {
    let v2 = createManuscriptV2(manuscript)
    for (let index = 0; index < 21; index += 1) v2 = addManuscriptBranch(v2, createManuscriptBranch(manuscript, { label: `Prijedlog ${index}`, source: 'agent', runId: 'run-1' }))
    expect(v2.branches).toHaveLength(20)
    expect(v2.branches.at(-1)).toMatchObject({ label: 'Prijedlog 20', source: 'agent', runId: 'run-1' })
  })
})
