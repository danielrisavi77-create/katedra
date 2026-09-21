import { describe, expect, it } from 'vitest'

import { loadOwnedWorkflow, WorkflowPersistenceError } from './repository'

const PROJECT = {
  id: 'project-1',
  user_id: 'user-1',
  deleted_at: null,
}

const STATE = {
  academic_project_id: 'project-1',
  stage: 'DRAFTING',
  target_submission_date: '2026-09-15',
  target_defense_date: null,
  deadline_authority_type: 'USER_REPORTED',
  deadline_source_id: null,
  deadline_source_label: 'Student target',
  mentor_last_sent_at: '2026-08-05T12:00:00.000Z',
  mentor_last_sent_version_label: 'v3',
  mentor_last_seen_version_label: 'v2',
  mentor_waiting_for_response: true,
  topic_approved: true,
  topic_approval_authority_type: 'USER_REPORTED',
  structure_approved: null,
  structure_approval_authority_type: null,
  methodology_approved: false,
  methodology_approval_authority_type: 'MENTOR_REPORTED',
  defense_approved: null,
  defense_approval_authority_type: null,
  submitted_at: null,
  defended_at: null,
  updated_at: '2026-08-06T12:00:00.000Z',
}

const TASK_LATE = {
  id: 'task-2',
  academic_project_id: 'project-1',
  task_type: 'MENTOR_RESPONSE',
  title: 'Review mentor feedback',
  status: 'OPEN',
  priority: 'HIGH',
  stage: 'REVISION',
  authority_type: 'SYSTEM_ASSESSED',
  authority_source_id: null,
  authority_source_label: 'Completion workflow',
  created_at: '2026-08-06T11:00:00.000Z',
  updated_at: '2026-08-06T11:00:00.000Z',
}

const TASK_EARLY = {
  id: 'task-1',
  academic_project_id: 'project-1',
  task_type: 'WRITE_SECTION',
  title: 'Draft methodology',
  status: 'IN_PROGRESS',
  priority: 'MEDIUM',
  stage: 'DRAFTING',
  authority_type: 'USER_REPORTED',
  authority_source_id: 'mentor-mail-1',
  authority_source_label: 'Mentor email',
  created_at: '2026-08-05T10:00:00.000Z',
  updated_at: '2026-08-06T10:00:00.000Z',
}

type FakeRow = Record<string, unknown>

type FakeDbOptions = {
  projects?: FakeRow[]
  states?: FakeRow[]
  tasks?: FakeRow[]
  errors?: Partial<Record<'academic_projects' | 'completion_project_state' | 'completion_tasks', string>>
}

function createWorkflowDb({
  projects = [PROJECT],
  states = [STATE],
  tasks = [TASK_LATE, TASK_EARLY],
  errors = {},
}: FakeDbOptions = {}) {
  const rowsByTable: Record<string, FakeRow[]> = {
    academic_projects: projects,
    completion_project_state: states,
    completion_tasks: tasks,
  }
  const calls: string[] = []

  return {
    calls,
    from(table: string) {
      calls.push(table)
      const predicates: Array<(row: FakeRow) => boolean> = []
      let orderColumn: string | null = null
      let ascending = true

      const execute = () => {
        const errorMessage = errors[table as keyof typeof errors]
        if (errorMessage) return { data: null, error: { message: errorMessage } }

        let data = (rowsByTable[table] ?? []).filter((row) =>
          predicates.every((predicate) => predicate(row)),
        )
        if (orderColumn) {
          data = [...data].sort((a, b) => {
            const left = String(a[orderColumn as string] ?? '')
            const right = String(b[orderColumn as string] ?? '')
            return (left < right ? -1 : left > right ? 1 : 0) * (ascending ? 1 : -1)
          })
        }
        return { data, error: null }
      }

      const query = {
        select() {
          return query
        },
        eq(column: string, value: unknown) {
          predicates.push((row) => row[column] === value)
          return query
        },
        is(column: string, value: unknown) {
          predicates.push((row) => row[column] === value)
          return query
        },
        order(column: string, options?: { ascending?: boolean }) {
          orderColumn = column
          ascending = options?.ascending !== false
          return query
        },
        async maybeSingle() {
          const result = execute()
          return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : null }
        },
        then(resolve: (value: { data: FakeRow[] | null; error: { message: string } | null }) => unknown) {
          return Promise.resolve(execute()).then(resolve)
        },
      }

      return query
    },
  }
}

describe('loadOwnedWorkflow', () => {
  it('maps canonical Completion workflow fields and orders tasks by creation time', async () => {
    const db = createWorkflowDb()

    const result = await loadOwnedWorkflow(db as never, {
      ownerUserId: 'user-1',
      projectId: 'project-1',
    })

    expect(result.kind).toBe('found')
    if (result.kind !== 'found') throw new Error('Expected found workflow')

    expect(result.workflow).toMatchObject({
      projectId: 'project-1',
      stage: 'DRAFTING',
      timeline: {
        targetSubmissionDate: '2026-09-15',
        targetDefenseDate: null,
        deadlineAuthority: {
          type: 'USER_REPORTED',
          sourceId: null,
          sourceLabel: 'Student target',
        },
      },
      mentor: {
        waitingForResponse: true,
        lastSentAt: '2026-08-05T12:00:00.000Z',
        lastSentVersionLabel: 'v3',
        lastSeenVersionLabel: 'v2',
        topicApproved: { value: true, authorityType: 'USER_REPORTED' },
        methodologyApproved: { value: false, authorityType: 'MENTOR_REPORTED' },
      },
      outcomes: { submittedAt: null, defendedAt: null },
      source: 'completion',
      updatedAt: '2026-08-06T12:00:00.000Z',
    })
    expect(result.workflow.tasks.map((task) => task.id)).toEqual(['task-1', 'task-2'])
  })

  it('returns not-owned for a foreign canonical project and does not load workflow tables', async () => {
    const db = createWorkflowDb()

    await expect(
      loadOwnedWorkflow(db as never, { ownerUserId: 'user-2', projectId: 'project-1' }),
    ).resolves.toEqual({ kind: 'not-owned' })
    expect(db.calls).toEqual(['academic_projects'])
  })

  it('returns missing-state for an owned canonical project without Completion state', async () => {
    const db = createWorkflowDb({ states: [] })

    await expect(
      loadOwnedWorkflow(db as never, { ownerUserId: 'user-1', projectId: 'project-1' }),
    ).resolves.toEqual({ kind: 'missing-state' })
    expect(db.calls).toEqual(['academic_projects', 'completion_project_state'])
  })

  it('treats a soft-deleted academic project as not owned for workflow reads', async () => {
    const db = createWorkflowDb({ projects: [{ ...PROJECT, deleted_at: '2026-08-06T09:00:00.000Z' }] })

    await expect(
      loadOwnedWorkflow(db as never, { ownerUserId: 'user-1', projectId: 'project-1' }),
    ).resolves.toEqual({ kind: 'not-owned' })
  })

  it('fails closed when the canonical project query fails', async () => {
    const db = createWorkflowDb({ errors: { academic_projects: 'project read failed' } })

    await expect(
      loadOwnedWorkflow(db as never, { ownerUserId: 'user-1', projectId: 'project-1' }),
    ).rejects.toBeInstanceOf(WorkflowPersistenceError)
  })

  it('fails closed when Completion state or task reads fail', async () => {
    const stateDb = createWorkflowDb({ errors: { completion_project_state: 'state read failed' } })
    const taskDb = createWorkflowDb({ errors: { completion_tasks: 'task read failed' } })

    await expect(
      loadOwnedWorkflow(stateDb as never, { ownerUserId: 'user-1', projectId: 'project-1' }),
    ).rejects.toBeInstanceOf(WorkflowPersistenceError)
    await expect(
      loadOwnedWorkflow(taskDb as never, { ownerUserId: 'user-1', projectId: 'project-1' }),
    ).rejects.toBeInstanceOf(WorkflowPersistenceError)
  })
})
