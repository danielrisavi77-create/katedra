import { describe, expect, it } from 'vitest'

import { hasActiveProjectPass } from './entitlements'

type EntitlementFixture = {
  id: string
  user_id: string
  academic_project_id: string | null
  status: string
  purchase_expires_at: string
}

function createEntitlementDb(rows: EntitlementFixture[]) {
  return {
    from(table: string) {
      if (table !== 'entitlements') throw new Error(`Unexpected table: ${table}`)

      const predicates: Array<(row: EntitlementFixture) => boolean> = []
      let limit = Number.POSITIVE_INFINITY

      const query = {
        select() {
          return query
        },
        eq(column: keyof EntitlementFixture, value: string) {
          predicates.push((row) => row[column] === value)
          return query
        },
        gt(column: keyof EntitlementFixture, value: string) {
          predicates.push((row) => String(row[column]) > value)
          return query
        },
        limit(value: number) {
          limit = value
          return query
        },
        async maybeSingle() {
          const data = rows.filter((row) => predicates.every((predicate) => predicate(row))).slice(0, limit)[0] ?? null
          return { data, error: null }
        },
      }

      return query
    },
  }
}

describe('hasActiveProjectPass', () => {
  it('accepts an active non-expired entitlement bound to the same project', async () => {
    const db = createEntitlementDb([
      {
        id: 'entitlement-1',
        user_id: 'user-1',
        academic_project_id: 'project-1',
        status: 'active',
        purchase_expires_at: '2026-12-31T23:59:59.000Z',
      },
    ])

    await expect(
      hasActiveProjectPass(db as never, {
        userId: 'user-1',
        projectId: 'project-1',
        now: new Date('2026-08-06T12:00:00.000Z'),
      }),
    ).resolves.toBe(true)
  })
})
