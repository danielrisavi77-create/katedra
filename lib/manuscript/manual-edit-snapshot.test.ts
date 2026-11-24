import { describe, expect, it } from 'vitest'

import { planManualEditSnapshot } from './manual-edit-snapshot'

describe('manual edit snapshot sessions', () => {
  it('snapshots before the first edit in a section', () => {
    const result = planManualEditSnapshot({
      state: { sessionKey: null, lastActivityAt: null },
      projectId: 'project-1',
      sectionId: 'intro',
      now: 100,
    })

    expect(result.shouldSnapshot).toBe(true)
    expect(result.nextState).toEqual({ sessionKey: 'project-1:intro', lastActivityAt: 100 })
  })

  it('does not create a snapshot for every keystroke in one active edit session', () => {
    const result = planManualEditSnapshot({
      state: { sessionKey: 'project-1:intro', lastActivityAt: 100 },
      projectId: 'project-1',
      sectionId: 'intro',
      now: 900,
    })

    expect(result.shouldSnapshot).toBe(false)
    expect(result.nextState.lastActivityAt).toBe(900)
  })

  it('starts a new snapshot session after an idle pause or section change', () => {
    const afterIdle = planManualEditSnapshot({
      state: { sessionKey: 'project-1:intro', lastActivityAt: 100 },
      projectId: 'project-1',
      sectionId: 'intro',
      now: 1300,
    })
    const afterSectionChange = planManualEditSnapshot({
      state: { sessionKey: 'project-1:intro', lastActivityAt: 100 },
      projectId: 'project-1',
      sectionId: 'methods',
      now: 200,
    })

    expect(afterIdle.shouldSnapshot).toBe(true)
    expect(afterSectionChange.shouldSnapshot).toBe(true)
  })
})
