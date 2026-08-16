import { describe, expect, it } from 'vitest'

import { getAdminAccess, isAdminOverrideUser } from './admin-access'

const confirmedDaniel = {
  id: 'user-daniel',
  email: 'danielrisavi77@gmail.com',
  email_confirmed_at: '2026-08-15T10:00:00.000Z',
  user_metadata: { role: 'admin' },
}

describe('server-side admin access', () => {
  const runtime = {
    KATEDRA_ADMIN_OVERRIDE_ENABLED: 'true',
    KATEDRA_ADMIN_EMAILS: 'danielrisavi77@gmail.com',
  }

  it('grants the override only to the exact confirmed allowlisted email', () => {
    expect(isAdminOverrideUser(confirmedDaniel, runtime)).toBe(true)
    expect(isAdminOverrideUser({ ...confirmedDaniel, email: 'other@example.com' }, runtime)).toBe(false)
    expect(isAdminOverrideUser({ ...confirmedDaniel, email: 'danielrisavi77+alias@gmail.com' }, runtime)).toBe(false)
  })

  it('normalizes email casing and configured whitespace without trusting user metadata', () => {
    expect(isAdminOverrideUser({ ...confirmedDaniel, email: '  DANIELRISAVI77@GMAIL.COM  ', user_metadata: { role: 'admin' } }, {
      ...runtime,
      KATEDRA_ADMIN_EMAILS: ' danielrisavi77@gmail.com , another@example.com ',
    })).toBe(true)
    expect(isAdminOverrideUser({ ...confirmedDaniel, email: 'other@example.com', user_metadata: { role: 'admin' } }, runtime)).toBe(false)
  })

  it('requires a confirmed email and an explicitly enabled override', () => {
    expect(isAdminOverrideUser({ ...confirmedDaniel, email_confirmed_at: null }, runtime)).toBe(false)
    expect(isAdminOverrideUser({ ...confirmedDaniel, confirmed_at: '2026-08-15T10:00:00.000Z', email_confirmed_at: null }, runtime)).toBe(false)
    expect(isAdminOverrideUser(confirmedDaniel, { ...runtime, KATEDRA_ADMIN_OVERRIDE_ENABLED: 'false' })).toBe(false)
  })

  it('exposes an explicit reason for the admin page without exposing the allowlist', () => {
    expect(getAdminAccess(confirmedDaniel, runtime)).toEqual({ allowed: true, reason: 'allowlisted_confirmed_email' })
    expect(getAdminAccess({ ...confirmedDaniel, email: 'other@example.com' }, runtime)).toEqual({ allowed: false, reason: 'email_not_allowlisted' })
    expect(getAdminAccess(confirmedDaniel, { ...runtime, KATEDRA_ADMIN_OVERRIDE_ENABLED: 'false' })).toEqual({ allowed: false, reason: 'override_disabled' })
  })
})
