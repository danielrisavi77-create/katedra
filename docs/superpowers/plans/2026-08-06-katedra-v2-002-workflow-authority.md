# Katedra V2-002 Workflow Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Katedra expose Academic Completion persistence as the canonical read authority for workflow state while preserving the existing Katedra v1 state response and PUT behavior.

**Architecture:** Add a narrow, typed workflow projection over `academic_projects`, `completion_project_state`, and `completion_tasks`; resolve that projection into either `completion` or `legacy-compat`; then attach the result to `/api/state` GET. Do not import the FPZG-specific Academic Completion domain mapper and do not add any write path or database migration.

**Tech Stack:** Next.js 16 route handlers, TypeScript, `@supabase/supabase-js`, `@supabase/ssr`, Vitest 4.1.10, canonical Supabase project `zrrjttizjyfcxmcpgzml`.

## Global Constraints

- Katedra remains a consumer of the existing Lekta production Supabase project; no Katedra-owned DDL or migration.
- `auth.users.id` is canonical account identity and `academic_projects.id` is canonical project identity.
- V2-002 is read-only for Completion workflow state; existing `/api/state` PUT behavior must remain unchanged.
- Legacy `deadline` and phase-like fields may remain in the response for v1 compatibility but are non-authoritative whenever `workflowAuthority === "completion"`.
- `legacy-compat` may be returned only for the authenticated user's current legacy selection when no canonical workflow is available; DB failures must fail closed.
- A lower-level explicit canonical lookup for another user's project must never return workflow data and must not be disguised as compatibility mode.
- Katedra must not read or mutate Lekta verification tables as part of this feature.
- Do not import or copy the current FPZG-specific Academic Completion domain mapper.
- Preserve stable task order as `completion_tasks.created_at ASC`.
- No new document body, source passage, mentor free-text, or manuscript content enters the workflow contract.
- Mandatory verification: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

---

## File Structure

**Create**
- `lib/academic-suite/workflow/types.ts` — serialized Katedra-facing workflow contract and repository result union.
- `lib/academic-suite/workflow/resolver.ts` — pure conversion from trusted legacy selection + repository result into `WorkflowResolution`.
- `lib/academic-suite/workflow/resolver.test.ts` — pure authority/fallback tests.
- `lib/academic-suite/workflow/repository.ts` — typed Supabase read adapter and persistence-error boundary.
- `lib/academic-suite/workflow/repository.test.ts` — repository ownership, missing-state, ordering, mapping, and error tests.
- `lib/academic-suite/workflow/state-route.test.ts` — source-boundary regression test for `/api/state`.

**Modify**
- `lib/academic-suite/database.types.ts` — extend the production-derived narrow projection with `academic_projects`, `completion_project_state`, and `completion_tasks`.
- `lib/academic-suite/database-contract.test.ts` — add compile-time guards for canonical workflow columns.
- `app/api/state/route.js` — GET only: attach canonical workflow resolution; leave PUT unchanged.

---

### Task 1: Extend the production-derived database contract

**Files:**
- Modify: `lib/academic-suite/database.types.ts`
- Modify: `lib/academic-suite/database-contract.test.ts`

**Interfaces:**
- Consumes: canonical Supabase generated types for project `zrrjttizjyfcxmcpgzml` generated on 2026-08-06.
- Produces: `Database['public']['Tables']['academic_projects' | 'completion_project_state' | 'completion_tasks']` for later typed repository queries.

- [ ] **Step 1: Write failing compile-time contract tests**

Append aliases and canonical-key assertions to `lib/academic-suite/database-contract.test.ts` before changing `database.types.ts`:

```ts
type AcademicProjectRow = Database['public']['Tables']['academic_projects']['Row']
type CompletionStateRow = Database['public']['Tables']['completion_project_state']['Row']
type CompletionTaskRow = Database['public']['Tables']['completion_tasks']['Row']

const academicProjectIdKey: keyof AcademicProjectRow = 'id'
const academicProjectOwnerKey: keyof AcademicProjectRow = 'user_id'
const academicProjectDeletedKey: keyof AcademicProjectRow = 'deleted_at'
const completionProjectKey: keyof CompletionStateRow = 'academic_project_id'
const completionDeadlineKey: keyof CompletionStateRow = 'target_submission_date'
const mentorWaitingKey: keyof CompletionStateRow = 'mentor_waiting_for_response'
const taskProjectKey: keyof CompletionTaskRow = 'academic_project_id'
const taskAuthorityKey: keyof CompletionTaskRow = 'authority_type'

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
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```bash
npx vitest run lib/academic-suite/database-contract.test.ts
```

Expected: TypeScript/Vitest transform fails because the three workflow tables do not yet exist in the checked-in `Database` projection.

- [ ] **Step 3: Extend `database.types.ts` from the verified production schema**

Keep the existing `entitlements` table unchanged and add exact production-derived definitions for these three tables. Use the generated production shapes below; do not invent fields.

```ts
academic_projects: {
  Row: {
    academic_year: string | null
    contract_version: string
    created_at: string
    deadline: string | null
    deleted_at: string | null
    id: string
    institution_id: string | null
    legacy_client_project_id: string | null
    mentor_name: string | null
    profile_id: string | null
    program_id: string | null
    purge_after: string | null
    ruleset_id: string | null
    ruleset_version: string | null
    stage: string
    title: string | null
    topic: string
    unit_id: string
    updated_at: string
    user_id: string
    work_type: string
  }
  Insert: {
    academic_year?: string | null
    contract_version?: string
    created_at?: string
    deadline?: string | null
    deleted_at?: string | null
    id?: string
    institution_id?: string | null
    legacy_client_project_id?: string | null
    mentor_name?: string | null
    profile_id?: string | null
    program_id?: string | null
    purge_after?: string | null
    ruleset_id?: string | null
    ruleset_version?: string | null
    stage?: string
    title?: string | null
    topic?: string
    unit_id?: string
    updated_at?: string
    user_id: string
    work_type: string
  }
  Update: {
    academic_year?: string | null
    contract_version?: string
    created_at?: string
    deadline?: string | null
    deleted_at?: string | null
    id?: string
    institution_id?: string | null
    legacy_client_project_id?: string | null
    mentor_name?: string | null
    profile_id?: string | null
    program_id?: string | null
    purge_after?: string | null
    ruleset_id?: string | null
    ruleset_version?: string | null
    stage?: string
    title?: string | null
    topic?: string
    unit_id?: string
    updated_at?: string
    user_id?: string
    work_type?: string
  }
  Relationships: []
}
completion_project_state: {
  Row: {
    academic_project_id: string
    ai_data_safety_acknowledged: boolean
    ai_disclosure_state: string
    ai_mentor_consultation: string
    ai_policy_ruleset_id: string | null
    ai_policy_ruleset_version: string | null
    ai_policy_verified_at: string | null
    created_at: string
    deadline_authority_type: string
    deadline_source_id: string | null
    deadline_source_label: string | null
    defended_at: string | null
    defense_approval_authority_type: string | null
    defense_approved: boolean | null
    mentor_last_seen_version_label: string | null
    mentor_last_sent_at: string | null
    mentor_last_sent_version_label: string | null
    mentor_waiting_for_response: boolean
    methodology_approval_authority_type: string | null
    methodology_approved: boolean | null
    stage: string
    structure_approval_authority_type: string | null
    structure_approved: boolean | null
    submitted_at: string | null
    target_defense_date: string | null
    target_submission_date: string | null
    topic_approval_authority_type: string | null
    topic_approved: boolean | null
    updated_at: string
  }
  Insert: {
    academic_project_id: string
    ai_data_safety_acknowledged?: boolean
    ai_disclosure_state?: string
    ai_mentor_consultation?: string
    ai_policy_ruleset_id?: string | null
    ai_policy_ruleset_version?: string | null
    ai_policy_verified_at?: string | null
    created_at?: string
    deadline_authority_type?: string
    deadline_source_id?: string | null
    deadline_source_label?: string | null
    defended_at?: string | null
    defense_approval_authority_type?: string | null
    defense_approved?: boolean | null
    mentor_last_seen_version_label?: string | null
    mentor_last_sent_at?: string | null
    mentor_last_sent_version_label?: string | null
    mentor_waiting_for_response?: boolean
    methodology_approval_authority_type?: string | null
    methodology_approved?: boolean | null
    stage?: string
    structure_approval_authority_type?: string | null
    structure_approved?: boolean | null
    submitted_at?: string | null
    target_defense_date?: string | null
    target_submission_date?: string | null
    topic_approval_authority_type?: string | null
    topic_approved?: boolean | null
    updated_at?: string
  }
  Update: {
    academic_project_id?: string
    ai_data_safety_acknowledged?: boolean
    ai_disclosure_state?: string
    ai_mentor_consultation?: string
    ai_policy_ruleset_id?: string | null
    ai_policy_ruleset_version?: string | null
    ai_policy_verified_at?: string | null
    created_at?: string
    deadline_authority_type?: string
    deadline_source_id?: string | null
    deadline_source_label?: string | null
    defended_at?: string | null
    defense_approval_authority_type?: string | null
    defense_approved?: boolean | null
    mentor_last_seen_version_label?: string | null
    mentor_last_sent_at?: string | null
    mentor_last_sent_version_label?: string | null
    mentor_waiting_for_response?: boolean
    methodology_approval_authority_type?: string | null
    methodology_approved?: boolean | null
    stage?: string
    structure_approval_authority_type?: string | null
    structure_approved?: boolean | null
    submitted_at?: string | null
    target_defense_date?: string | null
    target_submission_date?: string | null
    topic_approval_authority_type?: string | null
    topic_approved?: boolean | null
    updated_at?: string
  }
  Relationships: []
}
completion_tasks: {
  Row: {
    academic_project_id: string
    authority_source_id: string | null
    authority_source_label: string | null
    authority_type: string
    capability: string | null
    created_at: string
    id: string
    priority: string
    related_lekta_finding_ids: string[]
    related_rule_ids: string[]
    stage: string
    status: string
    task_type: string
    title: string
    updated_at: string
  }
  Insert: {
    academic_project_id: string
    authority_source_id?: string | null
    authority_source_label?: string | null
    authority_type: string
    capability?: string | null
    created_at?: string
    id?: string
    priority?: string
    related_lekta_finding_ids?: string[]
    related_rule_ids?: string[]
    stage: string
    status?: string
    task_type: string
    title: string
    updated_at?: string
  }
  Update: {
    academic_project_id?: string
    authority_source_id?: string | null
    authority_source_label?: string | null
    authority_type?: string
    capability?: string | null
    created_at?: string
    id?: string
    priority?: string
    related_lekta_finding_ids?: string[]
    related_rule_ids?: string[]
    stage?: string
    status?: string
    task_type?: string
    title?: string
    updated_at?: string
  }
  Relationships: []
}
```

Update the file header comment from “only the production `entitlements` projection” to say that the file contains only Katedra-required production projections.

- [ ] **Step 4: Run the contract test and TypeScript**

```bash
npx vitest run lib/academic-suite/database-contract.test.ts
npx tsc --noEmit
```

Expected: both commands PASS.

- [ ] **Step 5: Commit the DB contract slice**

```bash
git add lib/academic-suite/database.types.ts lib/academic-suite/database-contract.test.ts
git commit -m "test: add canonical workflow database contract"
```

---

### Task 2: Add the pure workflow contract and authority resolver

**Files:**
- Create: `lib/academic-suite/workflow/types.ts`
- Create: `lib/academic-suite/workflow/resolver.ts`
- Create: `lib/academic-suite/workflow/resolver.test.ts`

**Interfaces:**
- Produces: `WorkflowSnapshot`, `WorkflowLoadResult`, `WorkflowResolution`, and `resolveWorkflowForLegacySelection(candidateProjectId, loadResult)`.
- Consumes: no Supabase client; this task stays pure.

- [ ] **Step 1: Write RED resolver tests**

Create `resolver.test.ts` with explicit canonical, no-candidate, missing-state, and not-owned cases:

```ts
import { describe, expect, it } from 'vitest'
import { resolveWorkflowForLegacySelection } from './resolver'
import type { WorkflowSnapshot } from './types'

const WORKFLOW: WorkflowSnapshot = {
  projectId: 'project-1',
  stage: 'DRAFTING',
  timeline: {
    targetSubmissionDate: '2026-09-15',
    targetDefenseDate: null,
    deadlineAuthority: {
      type: 'USER_REPORTED',
      sourceId: null,
      sourceLabel: null,
    },
  },
  mentor: {
    waitingForResponse: true,
    lastSentAt: '2026-08-05T12:00:00.000Z',
    lastSentVersionLabel: 'v3',
    lastSeenVersionLabel: 'v2',
    topicApproved: { value: true, authorityType: 'USER_REPORTED' },
    structureApproved: { value: null, authorityType: null },
    methodologyApproved: { value: null, authorityType: null },
    defenseApproved: { value: null, authorityType: null },
  },
  tasks: [],
  outcomes: { submittedAt: null, defendedAt: null },
  source: 'completion',
  updatedAt: '2026-08-06T12:00:00.000Z',
}

describe('resolveWorkflowForLegacySelection', () => {
  it('returns canonical Completion workflow when found', () => {
    expect(
      resolveWorkflowForLegacySelection('project-1', { kind: 'found', workflow: WORKFLOW }),
    ).toEqual({ workflowAuthority: 'completion', workflow: WORKFLOW })
  })

  it('returns compatibility mode when the legacy row has no canonical candidate', () => {
    expect(resolveWorkflowForLegacySelection('', null)).toEqual({
      workflowAuthority: 'legacy-compat',
      workflow: null,
    })
  })

  it('returns compatibility mode for an owned project without Completion state', () => {
    expect(resolveWorkflowForLegacySelection('project-1', { kind: 'missing-state' })).toEqual({
      workflowAuthority: 'legacy-compat',
      workflow: null,
    })
  })

  it('returns compatibility mode for an unresolved candidate selected from the authenticated legacy row', () => {
    expect(resolveWorkflowForLegacySelection('legacy-k-123', { kind: 'not-owned' })).toEqual({
      workflowAuthority: 'legacy-compat',
      workflow: null,
    })
  })
})
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run lib/academic-suite/workflow/resolver.test.ts
```

Expected: FAIL because `types.ts` and `resolver.ts` do not exist.

- [ ] **Step 3: Implement the serialized workflow types**

Create `types.ts`:

```ts
export type WorkflowAuthority = 'completion' | 'legacy-compat'

export type ApprovalSnapshot = {
  value: boolean | null
  authorityType: string | null
}

export type WorkflowTaskSnapshot = {
  id: string
  type: string
  title: string
  status: string
  priority: string
  stage: string
  authority: {
    type: string
    sourceId: string | null
    sourceLabel: string | null
  }
}

export type WorkflowSnapshot = {
  projectId: string
  stage: string
  timeline: {
    targetSubmissionDate: string | null
    targetDefenseDate: string | null
    deadlineAuthority: {
      type: string
      sourceId: string | null
      sourceLabel: string | null
    }
  }
  mentor: {
    waitingForResponse: boolean
    lastSentAt: string | null
    lastSentVersionLabel: string | null
    lastSeenVersionLabel: string | null
    topicApproved: ApprovalSnapshot
    structureApproved: ApprovalSnapshot
    methodologyApproved: ApprovalSnapshot
    defenseApproved: ApprovalSnapshot
  }
  tasks: WorkflowTaskSnapshot[]
  outcomes: {
    submittedAt: string | null
    defendedAt: string | null
  }
  source: 'completion'
  updatedAt: string
}

export type WorkflowLoadResult =
  | { kind: 'found'; workflow: WorkflowSnapshot }
  | { kind: 'missing-state' }
  | { kind: 'not-owned' }

export type WorkflowResolution = {
  workflowAuthority: WorkflowAuthority
  workflow: WorkflowSnapshot | null
}
```

- [ ] **Step 4: Implement the pure resolver**

Create `resolver.ts`:

```ts
import type { WorkflowLoadResult, WorkflowResolution } from './types'

const LEGACY_COMPAT: WorkflowResolution = {
  workflowAuthority: 'legacy-compat',
  workflow: null,
}

export function resolveWorkflowForLegacySelection(
  candidateProjectId: string | null | undefined,
  loadResult: WorkflowLoadResult | null,
): WorkflowResolution {
  if (!candidateProjectId?.trim()) return LEGACY_COMPAT
  if (!loadResult || loadResult.kind !== 'found') return LEGACY_COMPAT

  return {
    workflowAuthority: 'completion',
    workflow: loadResult.workflow,
  }
}
```

This resolver is deliberately named for the trusted legacy-selection adapter. It must not be reused as an authorization decision for a future arbitrary project-ID endpoint.

- [ ] **Step 5: Run resolver tests and TypeScript**

```bash
npx vitest run lib/academic-suite/workflow/resolver.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit the pure contract slice**

```bash
git add lib/academic-suite/workflow/types.ts lib/academic-suite/workflow/resolver.ts lib/academic-suite/workflow/resolver.test.ts
git commit -m "feat: add workflow authority resolver"
```

---

### Task 3: Add the typed canonical workflow repository

**Files:**
- Create: `lib/academic-suite/workflow/repository.ts`
- Create: `lib/academic-suite/workflow/repository.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient<Database>`, `WorkflowLoadResult`.
- Produces: `loadOwnedWorkflow(db, { ownerUserId, projectId })` and `WorkflowPersistenceError`.

- [ ] **Step 1: Write RED repository behavior tests**

Create fixtures for one owned project, one Completion state, and two tasks deliberately supplied in reverse creation order. The tests must cover all of these behaviors:

```ts
describe('loadOwnedWorkflow', () => {
  it('maps canonical stage, deadline, mentor state, approvals, outcomes, and tasks')
  it('sorts tasks by created_at ascending through the canonical query')
  it('returns not-owned when the project does not resolve for owner + project id')
  it('returns missing-state when the owned project has no completion_project_state row')
  it('throws WorkflowPersistenceError when the project query fails')
  it('throws WorkflowPersistenceError when the state query fails')
  it('throws WorkflowPersistenceError when the task query fails')
})
```

Use a table-aware fake that records `eq`, `is`, and `order` calls and returns preset rows. The foreign-project test must verify that the state/task tables are never read after ownership lookup returns no row.

The canonical fixture should include:

```ts
const STATE = {
  academic_project_id: 'project-1',
  stage: 'DRAFTING',
  target_submission_date: '2026-09-15',
  target_defense_date: '2026-10-02',
  deadline_authority_type: 'OFFICIAL',
  deadline_source_id: 'rule-2026-1',
  deadline_source_label: 'FPZG rokovi 2026',
  mentor_last_sent_at: '2026-08-05T12:00:00.000Z',
  mentor_last_sent_version_label: 'v3',
  mentor_last_seen_version_label: 'v2',
  mentor_waiting_for_response: true,
  topic_approved: true,
  topic_approval_authority_type: 'MENTOR_CONFIRMED',
  structure_approved: true,
  structure_approval_authority_type: 'MENTOR_CONFIRMED',
  methodology_approved: null,
  methodology_approval_authority_type: null,
  defense_approved: null,
  defense_approval_authority_type: null,
  submitted_at: null,
  defended_at: null,
  updated_at: '2026-08-06T10:00:00.000Z',
}
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run lib/academic-suite/workflow/repository.test.ts
```

Expected: FAIL because `repository.ts` does not exist.

- [ ] **Step 3: Implement repository constants and error boundary**

Create `repository.ts` with exact read columns:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import type { WorkflowLoadResult, WorkflowSnapshot } from './types'

export type WorkflowDb = SupabaseClient<Database>

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
```

- [ ] **Step 4: Implement ownership-first reads**

The project check must be first and must include owner and soft-delete filtering:

```ts
const { data: project, error: projectError } = await db
  .from('academic_projects')
  .select('id')
  .eq('id', projectId)
  .eq('user_id', ownerUserId)
  .is('deleted_at', null)
  .maybeSingle()

if (projectError) {
  throw new WorkflowPersistenceError(`Could not load academic project: ${projectError.message}`)
}
if (!project) return { kind: 'not-owned' }
```

Only after that succeeds, read Completion state. If it is absent, return `{ kind: 'missing-state' }` without querying tasks.

Then load tasks using:

```ts
const { data: tasks, error: taskError } = await db
  .from('completion_tasks')
  .select(TASK_SELECT)
  .eq('academic_project_id', projectId)
  .order('created_at', { ascending: true })
```

Any query error throws `WorkflowPersistenceError`; no error may produce compatibility mode inside the repository.

- [ ] **Step 5: Map persistence rows to `WorkflowSnapshot`**

Use direct serialization, not the Academic Completion FPZG mapper:

```ts
const workflow: WorkflowSnapshot = {
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
    topicApproved: {
      value: state.topic_approved,
      authorityType: state.topic_approval_authority_type,
    },
    structureApproved: {
      value: state.structure_approved,
      authorityType: state.structure_approval_authority_type,
    },
    methodologyApproved: {
      value: state.methodology_approved,
      authorityType: state.methodology_approval_authority_type,
    },
    defenseApproved: {
      value: state.defense_approved,
      authorityType: state.defense_approval_authority_type,
    },
  },
  tasks: (tasks ?? []).map((task) => ({
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
  updatedAt: [state.updated_at, ...(tasks ?? []).map((task) => task.updated_at)]
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0],
}

return { kind: 'found', workflow }
```

This `updatedAt` definition reflects every serialized workflow fact: state plus task changes.

- [ ] **Step 6: Run repository tests and TypeScript**

```bash
npx vitest run lib/academic-suite/workflow/repository.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit the repository slice**

```bash
git add lib/academic-suite/workflow/repository.ts lib/academic-suite/workflow/repository.test.ts
git commit -m "feat: read canonical completion workflow"
```

---

### Task 4: Integrate canonical workflow into `/api/state` GET only

**Files:**
- Create: `lib/academic-suite/workflow/state-route.test.ts`
- Modify: `app/api/state/route.js`

**Interfaces:**
- Consumes: `loadOwnedWorkflow(db, { ownerUserId, projectId })`, `resolveWorkflowForLegacySelection(candidateProjectId, loadResult)`.
- Produces: existing legacy JSON fields plus `workflowAuthority` and `workflow`.

- [ ] **Step 1: Add a RED source-boundary regression test**

Create `state-route.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it('keeps canonical workflow reads behind the workflow module', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/state/route.js'), 'utf8')

  expect(source).toContain("import { loadOwnedWorkflow } from '@/lib/academic-suite/workflow/repository'")
  expect(source).toContain("import { resolveWorkflowForLegacySelection } from '@/lib/academic-suite/workflow/resolver'")
  expect(source).toContain('loadOwnedWorkflow(supabase, {')
  expect(source).toContain('workflowAuthority')
  expect(source).not.toContain(".from('completion_project_state')")
  expect(source).not.toContain(".from('completion_tasks')")
  expect(source).not.toContain(".from('academic_projects')")
})

it('leaves the legacy PUT path in place during V2-002', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/state/route.js'), 'utf8')
  const putSource = source.slice(source.indexOf('export async function PUT'))

  expect(putSource).toContain(".from('katedra_projects')")
  expect(putSource).toContain(".upsert(patch, { onConflict: 'user_id,guest_project_id' })")
  expect(putSource).not.toContain('loadOwnedWorkflow')
})
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run lib/academic-suite/workflow/state-route.test.ts
```

Expected: FAIL because the state route has not imported or called the workflow module.

- [ ] **Step 3: Add workflow imports without changing PUT**

At the top of `app/api/state/route.js`, add:

```js
import { loadOwnedWorkflow, WorkflowPersistenceError } from '@/lib/academic-suite/workflow/repository'
import { resolveWorkflowForLegacySelection } from '@/lib/academic-suite/workflow/resolver'
```

- [ ] **Step 4: Extend GET after the existing legacy row query**

Replace only the final GET response construction with this authority resolution pattern:

```js
  if (error) return Response.json({ error: 'Učitavanje nije uspjelo.' }, { status: 500 })

  const legacyState = rowToCamel(row)
  const candidateProjectId = cleanOpaqueId(row?.project_id)

  if (!candidateProjectId) {
    return Response.json({
      ...legacyState,
      ...resolveWorkflowForLegacySelection(null, null),
    })
  }

  try {
    const workflowLoad = await loadOwnedWorkflow(supabase, {
      ownerUserId: user.id,
      projectId: candidateProjectId,
    })

    return Response.json({
      ...legacyState,
      ...resolveWorkflowForLegacySelection(candidateProjectId, workflowLoad),
    })
  } catch (error) {
    if (error instanceof WorkflowPersistenceError) {
      return Response.json({ error: 'Učitavanje tijeka rada nije uspjelo.' }, { status: 500 })
    }
    throw error
  }
```

Do not normalize the legacy `deadline` into the workflow object and do not replace `legacyState.deadline`. Canonical authority is expressed only through `workflowAuthority` + `workflow.timeline.targetSubmissionDate`.

- [ ] **Step 5: Add a resolver regression for conflicting legacy deadline semantics**

The pure test should document that a Completion workflow stays unchanged regardless of a conflicting legacy value supplied by the route layer. Add this test next to the resolver tests:

```ts
it('never derives the canonical deadline from legacy state', () => {
  const resolution = resolveWorkflowForLegacySelection('project-1', {
    kind: 'found',
    workflow: WORKFLOW,
  })

  expect(resolution.workflowAuthority).toBe('completion')
  expect(resolution.workflow?.timeline.targetSubmissionDate).toBe('2026-09-15')
})
```

- [ ] **Step 6: Run targeted route/workflow tests**

```bash
npx vitest run \
  lib/academic-suite/workflow/resolver.test.ts \
  lib/academic-suite/workflow/repository.test.ts \
  lib/academic-suite/workflow/state-route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Verify the PUT diff is unchanged**

Run:

```bash
git diff master...HEAD -- app/api/state/route.js
```

Review the diff and verify no lines inside `export async function PUT` changed except line-number movement caused by GET imports/code above it. If PUT changed, revert those PUT changes before continuing.

- [ ] **Step 8: Commit the route integration slice**

```bash
git add app/api/state/route.js lib/academic-suite/workflow/state-route.test.ts lib/academic-suite/workflow/resolver.test.ts
git commit -m "feat: expose completion workflow from state api"
```

---

### Task 5: Full verification, security review, and PR readiness

**Files:**
- Review only: `.github/workflows/foundation-check.yml`
- Review only: `.github/workflows/academic-suite-browser-e2e.yml`
- Review: all V2-002 changed files

**Interfaces:**
- Consumes: completed V2-002 branch.
- Produces: a reviewable PR with evidence that tests, types, lint, build, DB authority, ownership boundary, and PUT compatibility are intact.

- [ ] **Step 1: Run all V2-002 tests**

```bash
npx vitest run lib/academic-suite/database-contract.test.ts lib/academic-suite/workflow/*.test.ts
```

Expected: all V2-002 tests PASS.

- [ ] **Step 2: Run the complete repository gate**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: every command exits 0. Record the final Vitest test-file/test counts in the PR body.

- [ ] **Step 3: Review the ownership/security boundary**

Confirm from code and tests:

```text
academic_projects query = id + user_id + deleted_at IS NULL
state/tasks query occurs only after owned project is found
DB error => WorkflowPersistenceError => HTTP 500
not-owned legacy candidate => legacy-compat only at trusted /api/state adapter
no service-role client introduced
no Lekta result table queried
no Completion write/RPC called
```

- [ ] **Step 4: Review schema authority**

Run:

```bash
git diff master...HEAD --name-only
```

Expected: no `supabase/migrations/`, SQL migration, or production DDL files appear.

If the repository's DB authority guard has a local script, run the same command used by its GitHub workflow; otherwise rely on the PR workflow and record its result before marking the PR ready.

- [ ] **Step 5: Review browser/integration implications**

The existing `academic-suite-browser-e2e.yml` only auto-runs for its historical foundation branch or `workflow_dispatch`; do not broaden that workflow as part of V2-002. Because this change is a server-side authenticated state-read boundary, the new repository/resolver/route tests are the required V2-002 integration coverage. If a manual browser E2E run is available on the PR, execute it as an additional non-blocking confidence check and record its result separately.

- [ ] **Step 6: Perform final diff review**

```bash
git diff --check
git diff master...HEAD --stat
git diff master...HEAD -- app/api/state/route.js lib/academic-suite/database.types.ts lib/academic-suite/workflow
```

Confirm:
- no TODO/TBD/placeholders;
- no direct `completion_*` reads in `/api/state`;
- no workflow writes;
- no FPZG ruleset import;
- no change to Lekta verification authority;
- no change to `/api/state` PUT behavior.

- [ ] **Step 7: Open a draft PR and wait for CI evidence before marking ready**

Use title:

```text
V2-002: make Completion the canonical workflow read authority
```

PR body must include:

```markdown
## Scope
- canonical read adapter for academic_projects + completion_project_state + completion_tasks
- explicit completion vs legacy-compat resolution
- /api/state GET integration only
- no schema migration and no workflow writes

## Security/authority
- ownership checked before state/tasks reads
- DB errors fail closed
- foreign canonical workflow is never returned
- Lekta authority untouched

## TDD evidence
- RED database contract before workflow tables were added to the projection
- RED resolver/repository/route tests before implementation
- final targeted and full-suite counts

## Verification
- npm test
- npx tsc --noEmit
- npm run lint
- npm run build
- DB authority guard
```

- [ ] **Step 8: Mark the PR ready only after required CI is green**

Required blocking evidence:
- Foundation check green (`npm ci`, tests, TypeScript, lint, build).
- DB authority guard green.
- Netlify preview status green if emitted for the PR.

Do not merge V2-002 as part of this plan unless the user explicitly approves merge after reviewing the completed PR.
