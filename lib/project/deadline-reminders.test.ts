import { describe, expect, it } from 'vitest'

import { daysUntilDeadline, reminderTier, recommendedDeadlineAction, shouldShowDeadlineReminder } from './deadline-reminders'

describe('deadline reminders', () => {
  const now = new Date('2026-08-22T15:00:00.000Z')

  it('normalizes calendar dates without timezone drift', () => {
    expect(daysUntilDeadline('2026-08-29', now)).toBe(7)
    expect(reminderTier(daysUntilDeadline('2026-08-25', now))).toBe('3d')
    expect(daysUntilDeadline('not-a-date', now)).toBeNull()
  })

  it('chooses one action based on the current lifecycle phase', () => {
    expect(recommendedDeadlineAction('writing')).toContain('pisati')
    expect(recommendedDeadlineAction('lekta')).toContain('Lekta')
    expect(reminderTier(2)).toBeNull()
    expect(shouldShowDeadlineReminder(7)).toBe(true)
    expect(shouldShowDeadlineReminder(3)).toBe(true)
    expect(shouldShowDeadlineReminder(1)).toBe(true)
    expect(shouldShowDeadlineReminder(6)).toBe(false)
    expect(shouldShowDeadlineReminder(30)).toBe(false)
    expect(shouldShowDeadlineReminder(31)).toBe(false)
    expect(shouldShowDeadlineReminder(0)).toBe(false)
  })
})
