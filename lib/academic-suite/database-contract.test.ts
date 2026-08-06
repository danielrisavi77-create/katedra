import { expect, it } from 'vitest'

import type { Database } from './database.types'

type EntitlementRow = Database['public']['Tables']['entitlements']['Row']
type EntitlementColumn = keyof EntitlementRow

type AcademicProjectRow = Database['public']['Tables']['academic_projects']['Row']
type CompletionStateRow = Database['public']['Tables']['completion_project_state']['Row']
type CompletionTaskRow = Database['public']['Tables']['completion_tasks']['Row']

const projectKey: EntitlementColumn = 'academic_project_id'
const expiryKey: EntitlementColumn = 'purchase_expires_at'

const academicProjectIdKey: keyof AcademicProjectRow = 'id'
const academicProjectOwnerKey: keyof AcademicProjectRow = 'user_id'
const academicProjectDeletedKey: keyof AcademicProjectRow = 'deleted_at'
const completionProjectKey: keyof CompletionStateRow = 'academic_project_id'
const completionDeadlineKey: keyof CompletionStateRow = 'target_submission_date'
const mentorWaitingKey: keyof CompletionStateRow = 'mentor_waiting_for_response'
const taskProjectKey: keyof CompletionTaskRow = 'academic_project_id'
const taskAuthorityKey: keyof CompletionTaskRow = 'authority_type'

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

it('exposes the canonical workflow tables from production', () => {
  expect(academicProjectIdKey).toBe('id')
  expect(academicProjectOwnerKey).toBe('user_id')
  expect(academicProjectDeletedKey).toBe('deleted_at')
  expect(completionProjectKey).toBe('academic_project_id')
  expect(completionDeadlineKey).toBe('target_submission_date')
  expect(mentorWaitingKey).toBe('mentor_waiting_for_response')
  expect(taskProjectKey).toBe('academic_project_id')
  expect(taskAuthorityKey).toBe('authority_type')
})
