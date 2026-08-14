import { describe, expect, it } from 'vitest'

import { resolveProjectCapability } from './server-capabilities'

function createDb({ userId = 'u1', projectId = 'p1', lock = null, entitlement = true, entitlementError = null }: { userId?: string; projectId?: string; lock?: Record<string, unknown> | null; entitlement?: boolean; entitlementError?: { message: string } | null } = {}) {
  return {
    auth: { async getUser() { return { data: { user: { id: userId } }, error: null } } },
    from(table: string) {
      const filters: Array<[string, unknown]> = []
      const query = {
        select() { return query },
        eq(column: string, value: unknown) { filters.push([column, value]); return query },
        or() { return query },
        gt() { return query },
        limit() { return query },
        async maybeSingle() {
          if (table === 'katedra_projects') return { data: filters.some(([key, value]) => key === 'project_id' && value === projectId) ? { user_id: userId, project_id: projectId, guest_project_id: null } : null, error: null }
          if (table === 'katedra_project_locks') return { data: lock, error: null }
          if (table === 'entitlements') return { data: entitlement ? { id: 'e1', product_id: 'katedra_pass_zavrsni' } : null, error: entitlementError }
          return { data: null, error: null }
        },
      }
      return query
    },
  }
}

describe('resolveProjectCapability', () => {
  it('rejects a mismatched authenticated user', async () => {
    await expect(resolveProjectCapability(createDb({ userId: 'u2' }) as never, { userId: 'u1', projectId: 'p1', capability: 'basic_plan' })).resolves.toMatchObject({ allowed: false, code: 'unauthenticated' })
  })

  it('requires the canonical lock and matching product entitlement', async () => {
    const db = createDb({ lock: { user_id: 'u1', project_id: 'p1', work_type: 'zavrsni', product_key: 'zavrsni' } })
    await expect(resolveProjectCapability(db as never, { userId: 'u1', projectId: 'p1', capability: 'methodology' })).resolves.toEqual({ allowed: true, tier: 'zavrsni', projectId: 'p1' })
  })

  it('fails closed when the lock work type and product key disagree', async () => {
    const db = createDb({ lock: { user_id: 'u1', project_id: 'p1', work_type: 'diplomski', product_key: 'zavrsni' } })
    await expect(resolveProjectCapability(db as never, { userId: 'u1', projectId: 'p1', capability: 'methodology' })).resolves.toMatchObject({ allowed: false, code: 'capability_unavailable' })
  })

  it('never allows web research from a caller-supplied policy flag', async () => {
    const db = createDb({ lock: { user_id: 'u1', project_id: 'p1', work_type: 'zavrsni', product_key: 'zavrsni' } })
    await expect(resolveProjectCapability(db as never, { userId: 'u1', projectId: 'p1', capability: 'web_research' })).resolves.toMatchObject({ allowed: false, code: 'policy_unverified' })
  })

  it('fails closed as unavailable when entitlement lookup errors', async () => {
    const db = createDb({
      lock: { user_id: 'u1', project_id: 'p1', work_type: 'zavrsni', product_key: 'zavrsni' },
      entitlementError: { message: 'entitlements unavailable' },
    })
    await expect(resolveProjectCapability(db as never, { userId: 'u1', projectId: 'p1', capability: 'methodology' })).resolves.toMatchObject({ allowed: false, code: 'capability_unavailable' })
  })
})
