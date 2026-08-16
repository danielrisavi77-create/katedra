export type AdminAccessReason =
  | 'allowlisted_confirmed_email'
  | 'unauthenticated'
  | 'override_disabled'
  | 'email_missing'
  | 'email_unconfirmed'
  | 'email_not_allowlisted'

export interface AdminAccessUser {
  email?: string | null
  email_confirmed_at?: string | null
  confirmed_at?: string | null
  user_metadata?: unknown
}

export interface AdminAccessResult {
  allowed: boolean
  reason: AdminAccessReason
}

type AdminAccessRuntime = Record<string, string | undefined>

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('en-US') : ''
}

function configuredAdminEmails(runtime: AdminAccessRuntime): Set<string> {
  return new Set(
    (runtime.KATEDRA_ADMIN_EMAILS || '')
      .split(',')
      .map(normalizeEmail)
      .filter(Boolean),
  )
}

export function getAdminAccess(
  user: AdminAccessUser | null | undefined,
  runtime: AdminAccessRuntime = process.env,
): AdminAccessResult {
  if (!user) return { allowed: false, reason: 'unauthenticated' }
  if (runtime.KATEDRA_ADMIN_OVERRIDE_ENABLED !== 'true') {
    return { allowed: false, reason: 'override_disabled' }
  }

  const email = normalizeEmail(user.email)
  if (!email) return { allowed: false, reason: 'email_missing' }
  if (!user.email_confirmed_at) return { allowed: false, reason: 'email_unconfirmed' }
  if (!configuredAdminEmails(runtime).has(email)) {
    return { allowed: false, reason: 'email_not_allowlisted' }
  }
  return { allowed: true, reason: 'allowlisted_confirmed_email' }
}

export function isAdminOverrideUser(
  user: AdminAccessUser | null | undefined,
  runtime: AdminAccessRuntime = process.env,
): boolean {
  return getAdminAccess(user, runtime).allowed
}
