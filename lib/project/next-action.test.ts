import { describe, expect, it } from 'vitest'

import { resolveNextAction } from './next-action'

describe('resolveNextAction', () => {
  it('sends an unprepared project to preparation', () => {
    expect(resolveNextAction({ stage: 'started', totalWords: 0, sectionCount: 1, reviewSectionCount: 0, hasMaterials: false, passActive: false }).destination).toBe('preparation')
  })

  it('sends a planned, Pass-active project to writing', () => {
    expect(resolveNextAction({ stage: 'planned', totalWords: 0, sectionCount: 4, reviewSectionCount: 0, hasMaterials: true, passActive: true }).destination).toBe('writing')
  })

  it('sends a project with review sections to review', () => {
    expect(resolveNextAction({ stage: 'review', totalWords: 1200, sectionCount: 4, reviewSectionCount: 2, hasMaterials: true, passActive: true }).destination).toBe('review')
  })

  it('offers Pass preparation before a paid review action', () => {
    const action = resolveNextAction({ stage: 'review', totalWords: 1200, sectionCount: 4, reviewSectionCount: 2, hasMaterials: true, passActive: false })

    expect(action).toMatchObject({ destination: 'preparation', cta: 'Aktiviraj Pass' })
  })
})
