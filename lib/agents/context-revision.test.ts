import { describe, expect, it } from 'vitest'

import { createManuscript } from '../manuscript/model'
import { createContextRevision } from './context-revision'

describe('createContextRevision', () => {
  it('is deterministic and independent of material order', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z', now: '2026-08-14T10:00:00.000Z' })
    const first = createContextRevision({ manuscript, materialIds: ['material-b', 'material-a'], now: '2026-08-14T10:01:00.000Z' })
    const second = createContextRevision({ manuscript, materialIds: ['material-a', 'material-b'], now: '2026-08-14T11:00:00.000Z' })
    expect(first).toBe(second)
  })

  it('changes when the manuscript or attached material changes', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z', now: '2026-08-14T10:00:00.000Z' })
    const original = createContextRevision({ manuscript, materialIds: ['material-a'] })
    const changedManuscript = { ...manuscript, updatedAt: '2026-08-14T10:02:00.000Z' }
    expect(createContextRevision({ manuscript: changedManuscript, materialIds: ['material-a'] })).not.toBe(original)
    expect(createContextRevision({ manuscript, materialIds: ['material-a', 'material-b'] })).not.toBe(original)
  })
})
