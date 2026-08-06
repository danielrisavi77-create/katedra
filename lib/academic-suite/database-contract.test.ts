import { expect, it } from 'vitest'

import type { Database } from './database.types'

type EntitlementRow = Database['public']['Tables']['entitlements']['Row']
type EntitlementColumn = keyof EntitlementRow

const projectKey: EntitlementColumn = 'academic_project_id'
const expiryKey: EntitlementColumn = 'purchase_expires_at'

// The next two assertions are intentionally compile-time guards. If the stale
// columns are ever reintroduced into the checked-in production projection,
// TypeScript reports an unused @ts-expect-error and CI fails.
// @ts-expect-error `project_id` is not a live entitlements column.
const staleProjectKey: EntitlementColumn = 'project_id'
// @ts-expect-error `scope` is a designed future contract field, not live SQL.
const staleScopeKey: EntitlementColumn = 'scope'

it('uses the canonical live Project Pass columns', () => {
  expect(projectKey).toBe('academic_project_id')
  expect(expiryKey).toBe('purchase_expires_at')
  expect(staleProjectKey).toBe('project_id')
  expect(staleScopeKey).toBe('scope')
})
