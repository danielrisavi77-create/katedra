import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveCanonicalProjectPass, resolveProjectCapability } from './server-capabilities'

function createDb({ userId = 'u1', userEmail = null, emailConfirmedAt = null, projectId = 'p1', lock = null, entitlement = true, entitlementError = null, projectLookupError = null }: { userId?: string; userEmail?: string | null; emailConfirmedAt?: string | null; projectId?: string; lock?: Record<string, unknown> | null; entitlement?: boolean; entitlementError?: { message: string } | null; projectLookupError?: { message: string } | null } = {}) {
  return {
    auth: { async getUser() { return { data: { user: { id: userId, email: userEmail, email_confirmed_at: emailConfirmedAt } }, error: null } } },
    from(table: string) {
      const filters: Array<[string, unknown]> = []
      const query = {
        select() { return query },
        eq(column: string, value: unknown) { filters.push([column, value]); return query },
        or() { return query },
        gt() { return query },
        limit() { return query },
        async maybeSingle() {
          if (table === 'katedra_projects') return { data: filters.some(([key, value]) => key === 'project_id' && value === projectId) ? { user_id: userId, project_id: projectId, guest_project_id: null } : null, error: projectLookupError }
          if (table === 'katedra_project_locks') return { data: lock, error: null }
          if (table === 'entitlements') return { data: entitlement ? { id: 'e1', product_id: 'katedra_pass_zavrsni' } : null, error: entitlementError }
          return { data: null, error: null }
        },
      }
      return query
    },
  }
}

function lockFixture(overrides: Record<string, unknown> = {}) {
  return {
    lock_id: 'lock-1',
    user_id: 'u1',
    project_id: 'p1',
    topic: 'Digitalizacija javne uprave',
    work_type: 'zavrsni',
    product_key: 'zavrsni',
    payment_id: 'cs_test_123',
    locked_at: '2026-08-14T10:00:00.000Z',
    ...overrides,
  }
}

describe('resolveProjectCapability', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects a mismatched authenticated user', async () => {
    await expect(resolveProjectCapability(createDb({ userId: 'u2' }) as never, { userId: 'u1', projectId: 'p1', capability: 'basic_plan' })).resolves.toMatchObject({ allowed: false, code: 'unauthenticated' })
  })

  it('requires the canonical lock and matching product entitlement', async () => {
    const db = createDb({ lock: lockFixture() })
    await expect(resolveProjectCapability(db as never, { userId: 'u1', projectId: 'p1', capability: 'methodology' })).resolves.toEqual({ allowed: true, tier: 'zavrsni', projectId: 'p1' })
  })

  it('fails closed when the lock work type and product key disagree', async () => {
    const db = createDb({ lock: lockFixture({ work_type: 'diplomski' }) })
    await expect(resolveProjectCapability(db as never, { userId: 'u1', projectId: 'p1', capability: 'methodology' })).resolves.toMatchObject({ allowed: false, code: 'capability_unavailable' })
  })

  it('never allows web research from a caller-supplied policy flag', async () => {
    const db = createDb({ lock: lockFixture() })
    await expect(resolveProjectCapability(db as never, { userId: 'u1', projectId: 'p1', capability: 'web_research' })).resolves.toMatchObject({ allowed: false, code: 'policy_unverified' })
  })

  it('fails closed as unavailable when entitlement lookup errors', async () => {
    const db = createDb({
      lock: lockFixture(),
      entitlementError: { message: 'entitlements unavailable' },
    })
    await expect(resolveProjectCapability(db as never, { userId: 'u1', projectId: 'p1', capability: 'methodology' })).resolves.toMatchObject({ allowed: false, code: 'capability_unavailable' })
  })

  it('reports project lookup failures as unavailable instead of not-owned', async () => {
    const db = createDb({ projectLookupError: { message: 'projects unavailable' } })
    await expect(resolveProjectCapability(db as never, { userId: 'u1', projectId: 'p1', capability: 'section_writing' })).resolves.toMatchObject({ allowed: false, code: 'capability_unavailable' })
  })

  it('grants every capability to the confirmed allowlisted admin without a lock or Pass', async () => {
    vi.stubEnv('KATEDRA_ADMIN_OVERRIDE_ENABLED', 'true')
    vi.stubEnv('KATEDRA_ADMIN_EMAILS', 'danielrisavi77@gmail.com')
    const db = createDb({ userEmail: 'danielrisavi77@gmail.com', emailConfirmedAt: '2026-08-15T10:00:00.000Z', lock: null, entitlement: false })

    await expect(resolveProjectCapability(db as never, { userId: 'u1', projectId: 'p1', capability: 'web_research' })).resolves.toEqual({
      allowed: true,
      tier: 'diplomski',
      projectId: 'p1',
      adminOverride: true,
      unlimited: true,
    })
  })
})

describe('resolveCanonicalProjectPass', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not let an admin override replace the canonical Pass', async () => {
    vi.stubEnv('KATEDRA_ADMIN_OVERRIDE_ENABLED', 'true')
    vi.stubEnv('KATEDRA_ADMIN_EMAILS', 'danielrisavi77@gmail.com')
    const db = createDb({ userEmail: 'danielrisavi77@gmail.com', emailConfirmedAt: '2026-08-15T10:00:00.000Z', lock: null, entitlement: false })

    await expect(resolveCanonicalProjectPass(db as never, { userId: 'u1', projectId: 'p1' })).resolves.toMatchObject({
      allowed: false,
      code: 'pass_required',
    })
  })

  it('requires a matching lock and exact active entitlement', async () => {
    const db = createDb({ lock: lockFixture() })

    await expect(resolveCanonicalProjectPass(db as never, { userId: 'u1', projectId: 'p1' })).resolves.toEqual({
      allowed: true,
      projectId: 'p1',
      productKey: 'zavrsni',
    })
  })
})
