import { describe, expect, it } from 'vitest'

import { academicVisibilityForStatus } from './visibility'
import { assessAcademicFreshness } from './freshness'

describe('academic context visibility', () => {
  it('exposes full institutional capabilities only for verified rules', () => {
    expect(academicVisibilityForStatus('verified')).toMatchObject({
      label: 'Pravila verificirana',
      canClaimFacultyRules: true,
      canPurchasePass: true,
      aiMode: 'full',
    })
  })

  it('keeps partial, research and generic profiles in transparent free mode', () => {
    for (const status of ['partial', 'research', 'generic'] as const) {
      expect(academicVisibilityForStatus(status)).toMatchObject({
        canClaimFacultyRules: false,
        canPurchasePass: false,
        aiMode: 'generic',
      })
    }
  })

  it('treats invalid dates as unverified and reports old valid dates as stale advice', () => {
    expect(assessAcademicFreshness(undefined)).toEqual({ validDate: false, isStale: false })
    expect(assessAcademicFreshness('not-a-date')).toEqual({ validDate: false, isStale: false })
    expect(assessAcademicFreshness('2026-06-28', { now: new Date('2026-08-22T00:00:00.000Z'), maxAgeDays: 30 })).toMatchObject({ validDate: true, ageDays: 55, isStale: true })
  })
})
