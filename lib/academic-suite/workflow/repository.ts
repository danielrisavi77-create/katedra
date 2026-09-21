import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import type { WorkflowLoadResult, WorkflowSnapshot } from './types'

export type TypedWorkflowClient = SupabaseClient<Database>

type CompletionStateRow = Database['public']['Tables']['completion_project_state']['Row']
type CompletionTaskRow = Database['public']['Tables']['completion_tasks']['Row']

const STATE_SELECT = [
  'academic_project_id',
  'stage',
  'target_submission_date',
  'target_defense_date',
  'deadline_authority_type',
  'deadline_source_id',
  'deadline_source_label',
  'mentor_last_sent_at',
  'mentor_last_sent_version_label',
  'mentor_last_seen_version_label',
  'mentor_waiting_for_response',
  'topic_approved',
  'topic_approval_authority_type',
  'structure_approved',
  'structure_approval_authority_type',
  'methodology_approved',
  'methodology_approval_authority_type',
  'defense_approved',
  'defense_approval_authority_type',
  'submitted_at',
  'defended_at',
  'updated_at',
].join(',')

const TASK_SELECT = [
  'id',
  'academic_project_id',
  'task_type',
  'title',
  'status',
  'priority',
  'stage',
  'authority_type',
  'authority_source_id',
  'authority_source_label',
  'created_at',
  'updated_at',
].join(',')

export class WorkflowPersistenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowPersistenceError'
  }
}

function approval(value: boolean | null, authorityType: string | null) {
  return { value, authorityType }
}

function toWorkflowSnapshot(
  projectId: string,
  state: CompletionStateRow,
  tasks: CompletionTaskRow[],
): WorkflowSnapshot {
  return {
    projectId,
    stage: state.stage,
    timeline: {
      targetSubmissionDate: state.target_submission_date,
      targetDefenseDate: state.target_defense_date,
      deadlineAuthority: {
        type: state.deadline_authority_type,
        sourceId: state.deadline_source_id,
        sourceLabel: state.deadline_source_label,
      },
    },
    mentor: {
      waitingForResponse: state.mentor_waiting_for_response,
      lastSentAt: state.mentor_last_sent_at,
      lastSentVersionLabel: state.mentor_last_sent_version_label,
      lastSeenVersionLabel: state.mentor_last_seen_version_label,
      topicApproved: approval(state.topic_approved, state.topic_approval_authority_type),
      structureApproved: approval(state.structure_approved, state.structure_approval_authority_type),
      methodologyApproved: approval(
        state.methodology_approved,
        state.methodology_approval_authority_type,
      ),
      defenseApproved: approval(state.defense_approved, state.defense_approval_authority_type),
    },
    tasks: tasks.map((task) => ({
      id: task.id,
      type: task.task_type,
      title: task.title,
      status: task.status,
      priority: task.priority,
      stage: task.stage,
      authority: {
        type: task.authority_type,
        sourceId: task.authority_source_id,
        sourceLabel: task.authority_source_label,
      },
    })),
    outcomes: {
      submittedAt: state.submitted_at,
      defendedAt: state.defended_at,
    },
    source: 'completion',
    updatedAt: state.updated_at,
  }
}

export async function loadOwnedWorkflow(
  db: TypedWorkflowClient,
  input: { ownerUserId: string; projectId: string },
): Promise<WorkflowLoadResult> {
  const { ownerUserId, projectId } = input

  const { data: projectData, error: projectError } = await db
    .from('academic_projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', ownerUserId)
    .is('deleted_at', null)
    .maybeSingle()

  if (projectError) {
    throw new WorkflowPersistenceError(`Could not verify workflow project ownership: ${projectError.message}`)
  }
  if (!projectData) return { kind: 'not-owned' }

  const { data: stateData, error: stateError } = await db
    .from('completion_project_state')
    .select(STATE_SELECT)
    .eq('academic_project_id', projectId)
    .maybeSingle()

  if (stateError) {
    throw new WorkflowPersistenceError(`Could not load Completion workflow state: ${stateError.message}`)
  }
  if (!stateData) return { kind: 'missing-state' }

  const { data: taskData, error: taskError } = await db
    .from('completion_tasks')
    .select(TASK_SELECT)
    .eq('academic_project_id', projectId)
    .order('created_at', { ascending: true })

  if (taskError) {
    throw new WorkflowPersistenceError(`Could not load Completion workflow tasks: ${taskError.message}`)
  }

  return {
    kind: 'found',
    workflow: toWorkflowSnapshot(
      projectId,
      stateData as unknown as CompletionStateRow,
      (taskData ?? []) as unknown as CompletionTaskRow[],
    ),
  }
}
