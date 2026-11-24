import { describe, expect, it } from 'vitest'

import { isCleanLektaResult, resolveManuscriptProjectStage } from './lifecycle-state'

const cleanLekta = { score: 100, checkedAt: '2026-08-22T10:00:00.000Z', issues: [] }

describe('project lifecycle state', () => {
  it('requires a verified score, timestamp and no open findings for completion', () => {
    expect(isCleanLektaResult(cleanLekta)).toBe(true)
    expect(isCleanLektaResult({ ...cleanLekta, score: 99 })).toBe(false)
    expect(isCleanLektaResult({ ...cleanLekta, checkedAt: '' })).toBe(false)
    expect(isCleanLektaResult({ ...cleanLekta, issues: [{ severity: 'warning' }] })).toBe(false)
    expect(isCleanLektaResult({ ...cleanLekta, issues: [{ status: 'resolved' }] })).toBe(true)
  })

  it('keeps approved work in Lekta until a clean result exists', () => {
    const sections = [{ status: 'approved' }, { status: 'approved' }]
    expect(resolveManuscriptProjectStage({ sections, totalWords: 5000, lektaSummary: { score: null, checkedAt: '', issues: [] } })).toBe('lekta')
    expect(resolveManuscriptProjectStage({ sections, totalWords: 5000, lektaSummary: cleanLekta })).toBe('completed')
  })

  it('does not claim completion from approved sections alone', () => {
    expect(resolveManuscriptProjectStage({
      sections: [{ status: 'approved' }],
      totalWords: 1000,
      lektaSummary: { score: 100, checkedAt: '', issues: [] },
    })).toBe('lekta')
  })
})
