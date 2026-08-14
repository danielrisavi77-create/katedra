import { describe, expect, it } from 'vitest'

import { hasActiveProjectPass } from './entitlements'

type EntitlementFixture = {
  id: string
  user_id: string
  academic_project_id: string | null
  provider: string
  product_id: string | null
  status: string
  purchase_expires_at: string
}

const NOW = new Date('2026-08-06T12:00:00.000Z')

const ACTIVE_PASS: EntitlementFixture = {
  id: 'entitlement-1',
  user_id: 'user-1',
  academic_project_id: 'project-1',
  provider: 'stripe',
  product_id: null,
  status: 'active',
  purchase_expires_at: '2026-12-31T23:59:59.000Z',
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
        is(column: keyof EntitlementFixture, value: null) {
          predicates.push((row) => row[column] === value)
          return query
        },
        or(filter: string) {
          const allowed: string[] = filter.match(/katedra_pass_[a-z]+/g) || []
          predicates.push((row) => row.product_id === null || allowed.includes(row.product_id || ''))
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
          const data = rows
            .filter((row) => predicates.every((predicate) => predicate(row)))
            .slice(0, limit)[0] ?? null
          return { data, error: null }
        },
      }

      return query
    },
  }
}

async function resolvePass(rows: EntitlementFixture[], overrides: Partial<{ userId: string; projectId: string }> = {}) {
  return hasActiveProjectPass(createEntitlementDb(rows) as never, {
    userId: overrides.userId ?? 'user-1',
    projectId: overrides.projectId ?? 'project-1',
    now: NOW,
  })
}

describe('hasActiveProjectPass', () => {
  it('accepts an active non-expired Katedra Project Pass bound to the same project', async () => {
    await expect(resolvePass([ACTIVE_PASS])).resolves.toBe(true)
  })

  it('rejects an expired entitlement', async () => {
    await expect(
      resolvePass([
        {
          ...ACTIVE_PASS,
          purchase_expires_at: '2026-08-06T11:59:59.000Z',
        },
      ]),
    ).resolves.toBe(false)
  })

  it('rejects an entitlement owned by another user', async () => {
    await expect(resolvePass([{ ...ACTIVE_PASS, user_id: 'user-2' }])).resolves.toBe(false)
  })

  it('rejects an entitlement bound to another academic project', async () => {
    await expect(
      resolvePass([{ ...ACTIVE_PASS, academic_project_id: 'project-2' }]),
    ).resolves.toBe(false)
  })

  it('rejects a non-active entitlement', async () => {
    await expect(resolvePass([{ ...ACTIVE_PASS, status: 'consumed' }])).resolves.toBe(false)
  })

  it('rejects a Lekta retail entitlement even when it is active and project-bound', async () => {
    await expect(
      resolvePass([
        {
          ...ACTIVE_PASS,
          provider: 'lemonsqueezy',
          product_id: 'pass_semestralni',
        },
      ]),
    ).resolves.toBe(false)
  })

  it('rejects an unknown Stripe catalog product', async () => {
    await expect(
      resolvePass([{ ...ACTIVE_PASS, product_id: 'some-catalog-product' }]),
    ).resolves.toBe(false)
  })

  it('accepts a known Katedra catalog Pass product', async () => {
    await expect(
      resolvePass([{ ...ACTIVE_PASS, product_id: 'katedra_pass_diplomski' }]),
    ).resolves.toBe(true)
  })

  it('returns false when there is no matching entitlement', async () => {
    await expect(resolvePass([])).resolves.toBe(false)
  })

  it('fails closed when the entitlement client throws', async () => {
    await expect(hasActiveProjectPass({
      from() { throw new Error('database unavailable') },
    } as never, { userId: 'user-1', projectId: 'project-1', now: NOW })).resolves.toBe(false)
  })
})
