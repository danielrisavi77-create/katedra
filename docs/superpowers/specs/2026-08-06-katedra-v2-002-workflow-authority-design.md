# Katedra V2-002 — Workflow Authority Design

Date: 2026-08-06
Status: Approved design, ready for implementation planning after user review
Scope: Read-authority migration only

## 1. Goal

Make the existing Academic Completion workflow state the canonical workflow authority consumed by Katedra, without performing a big-bang rewrite of Katedra v1 and without creating a second workflow engine.

After V2-002, Katedra remains the user-facing product, while the existing shared Completion persistence becomes the source of truth for project stage, submission/defense timeline, mentor workflow, task state, and completion outcomes whenever canonical Completion state exists.

V2-002 does not migrate workflow writes yet. It establishes a safe read boundary first.

## 2. Why this change is necessary

Katedra currently persists overlapping process data in its own legacy state path, including deadline and wizard/process state. Academic Completion already persists a stronger workflow model using the shared Academic Suite project identity and dedicated Completion tables.

Allowing both models to remain equally authoritative would create divergent deadlines, stages, mentor approvals, and tasks. V2-002 removes that ambiguity for reads.

The migration must not copy the full Academic Completion application/domain into Katedra. The current Completion mapper is still FPZG-specific in important places, so V2-002 introduces a smaller Katedra-facing workflow projection over the canonical shared tables instead of importing Completion's entire current build-time domain.

## 3. Product topology

User-facing products remain:

1. Katedra — academic process/content copilot.
2. Lekta — deterministic technical/document verification authority.

Academic Completion becomes internal/shared workflow infrastructure behind Katedra rather than a third product students need to understand.

Katedra remains responsible for presenting the workflow UX. Completion persistence is responsible for canonical workflow facts.

## 4. Canonical workflow ownership

For V2-002, canonical read ownership is:

| Concern | Canonical source |
| --- | --- |
| Project identity | `academic_projects.id` |
| Project stage | `completion_project_state.stage` |
| Submission target | `completion_project_state.target_submission_date` |
| Defense target | `completion_project_state.target_defense_date` |
| Deadline authority/provenance | `completion_project_state.deadline_*` |
| Mentor waiting state | `completion_project_state.mentor_waiting_for_response` |
| Mentor send/seen metadata | `completion_project_state.mentor_*` |
| Topic approval | `completion_project_state.topic_approved` + authority |
| Structure approval | `completion_project_state.structure_approved` + authority |
| Methodology approval | `completion_project_state.methodology_approved` + authority |
| Defense approval | `completion_project_state.defense_approved` + authority |
| Workflow tasks | `completion_tasks` |
| Submission outcome | `completion_project_state.submitted_at` |
| Defense outcome | `completion_project_state.defended_at` |
| Legacy Katedra content/UI state | Existing Katedra state tables/routes |
| Lekta verification result | Lekta only |

A legacy Katedra deadline or phase value must never override canonical Completion state when canonical state exists.

The legacy top-level `deadline` field may remain in `/api/state` for backward compatibility during V2-002, but it is explicitly non-authoritative whenever `workflowAuthority === "completion"`. New V2 consumers must use `workflow.timeline.targetSubmissionDate`.

## 5. Architecture

V2-002 introduces a narrow adapter inside Katedra:

```text
academic_projects
completion_project_state
completion_tasks
        |
        v
Katedra Workflow Repository
        |
        v
Workflow Resolver
        |
        v
/api/state GET
        |
        +--> existing legacy Katedra response fields
        +--> workflowAuthority
        +--> workflow
```

Target module layout:

```text
lib/academic-suite/workflow/
  types.ts
  repository.ts
  resolver.ts
  repository.test.ts
  resolver.test.ts
```

The module is a read adapter. It is not a second workflow engine and must not duplicate Completion mutation logic.

## 6. Katedra-facing workflow contract

Initial V2-002 projection:

```ts
export type WorkflowAuthority = "completion" | "legacy-compat";

export type WorkflowSnapshot = {
  projectId: string;
  stage: string;
  timeline: {
    targetSubmissionDate: string | null;
    targetDefenseDate: string | null;
    deadlineAuthority: {
      type: string;
      sourceId: string | null;
      sourceLabel: string | null;
    };
  };
  mentor: {
    waitingForResponse: boolean;
    lastSentAt: string | null;
    lastSentVersionLabel: string | null;
    lastSeenVersionLabel: string | null;
    topicApproved: ApprovalSnapshot;
    structureApproved: ApprovalSnapshot;
    methodologyApproved: ApprovalSnapshot;
    defenseApproved: ApprovalSnapshot;
  };
  tasks: WorkflowTaskSnapshot[];
  outcomes: {
    submittedAt: string | null;
    defendedAt: string | null;
  };
  source: "completion";
  updatedAt: string;
};

export type ApprovalSnapshot = {
  value: boolean | null;
  authorityType: string | null;
};

export type WorkflowTaskSnapshot = {
  id: string;
  type: string;
  title: string;
  status: string;
  priority: string;
  stage: string;
  authority: {
    type: string;
    sourceId: string | null;
    sourceLabel: string | null;
  };
};
```

The initial contract intentionally uses stable serialized strings for shared enum-like values rather than importing the entire Completion domain. V2-003+ may tighten shared enum types after the ownership boundary is established.

Tasks are returned in stable `created_at ASC` order unless the shared Completion contract later defines a different canonical ordering.

## 7. Repository responsibilities

`repository.ts` must:

1. Require `ownerUserId` and canonical `projectId`.
2. Verify the project exists in `academic_projects` and belongs to that user.
3. Load `completion_project_state` for the same `academic_project_id`.
4. Load `completion_tasks` for the same `academic_project_id`.
5. Return a typed persistence result only; no UI fallback decisions.
6. Fail closed on database errors.
7. Never query or mutate Lekta result tables.
8. Never write Completion state in V2-002.

The repository must not load another user's workflow even if a caller supplies a valid foreign project UUID.

The repository result must distinguish at least:

- owned canonical project + Completion state;
- owned canonical project + no Completion state;
- canonical project not owned/not found for the supplied owner;
- database/query failure.

It must not collapse these states into a single nullable row.

## 8. Resolver responsibilities

`resolver.ts` decides which workflow authority is exposed to Katedra.

### Canonical case

If:

- the project exists and belongs to the user; and
- a matching `completion_project_state` row exists,

return:

```ts
{
  workflowAuthority: "completion",
  workflow: WorkflowSnapshot
}
```

Completion state wins over overlapping legacy values.

### Compatibility case

There are two compatibility cases at the `/api/state` adapter boundary:

1. an owned canonical academic project exists but has no Completion state yet;
2. the current legacy Katedra row has no usable canonical academic-project identity at all, for example an older guest-only/opaque project ID that does not resolve to an owned `academic_projects` row.

Both expose:

```ts
{
  workflowAuthority: "legacy-compat",
  workflow: null
}
```

This is an explicit compatibility state. The resolver must not synthesize a fake canonical workflow from `katedra_projects.deadline`, PHASES, localStorage, or other legacy process data.

The second case is compatibility only when the candidate project identity comes from the authenticated user's own legacy Katedra row. It must not become a general rule that arbitrary foreign project IDs silently downgrade to compatibility mode.

### Error case

A database error must propagate as an application error and produce a server failure response. It must not silently downgrade to `legacy-compat`, because that would hide canonical-state outages as if the project merely had no Completion state.

An explicit repository/API attempt to load a canonical project that belongs to another user must be denied/not returned as workflow and must not be represented as `legacy-compat`.

## 9. `/api/state` integration

V2-002 changes only the GET read path.

Existing response fields remain for backward compatibility. The route is extended with:

```json
{
  "workflowAuthority": "completion",
  "workflow": {
    "projectId": "...",
    "stage": "DRAFTING",
    "timeline": {},
    "mentor": {},
    "tasks": [],
    "outcomes": {},
    "source": "completion",
    "updatedAt": "..."
  }
}
```

or, when canonical Completion state is absent/unavailable because the authenticated user's current legacy row has not yet been reconciled to a canonical academic project:

```json
{
  "workflowAuthority": "legacy-compat",
  "workflow": null
}
```

The existing PUT behavior remains unchanged in V2-002. This avoids introducing dual-write behavior before a command/write design is defined.

## 10. Project selection behavior

The current GET route loads the user's most recently updated legacy `katedra_projects` row. V2-002 preserves that selection behavior.

The route takes that authenticated user's selected legacy row and treats its `project_id` only as a candidate canonical academic project identity.

Resolution rules:

1. If the candidate resolves to an `academic_projects` row owned by the same user and Completion state exists, expose `completion` workflow authority.
2. If the owned academic project exists but Completion state is missing, expose `legacy-compat`.
3. If the authenticated user's own legacy row contains an older guest/opaque ID that does not resolve to an owned canonical `academic_projects` row, expose `legacy-compat`.
4. If a lower-level repository call is explicitly given a valid canonical project belonging to another user, deny/not-found it; do not expose compatibility state for that foreign project.

V2-002 does not redesign project selection, multi-project navigation, or guest-to-canonical project reconciliation. Those remain separate migration concerns.

## 11. Database contract

Katedra remains a consumer, not schema authority.

V2-002 may extend the checked-in production-derived TypeScript projection to include only the columns required from:

- `academic_projects`;
- `completion_project_state`;
- `completion_tasks`.

No migration or DDL is added to Katedra.

If a required field does not exist in canonical production, implementation must stop rather than inventing a Katedra-local schema.

## 12. Failure and safety semantics

The implementation must distinguish these states:

1. `completion` — canonical state loaded successfully.
2. `legacy-compat` — the authenticated user's selected legacy project has not yet produced a complete canonical Completion workflow state.
3. server error — canonical lookup failed because of a DB/query/contract failure.
4. unauthorized/not-owned — an explicit canonical project lookup does not belong to the caller.

The code must never convert state 3 or 4 into state 2.

A missing canonical academic-project row may become state 2 only at the trusted `/api/state` compatibility adapter when the candidate ID originated from the authenticated user's own legacy Katedra row.

## 13. Privacy boundary

Workflow reads are limited to structured process metadata required by the Katedra UX. V2-002 does not add academic document body, source passages, mentor free-text, or generated manuscript content to the workflow contract.

This keeps V2-002 independent of the larger Academic Content Storage & Privacy V2 ADR.

## 14. Testing strategy

V2-002 is implemented test-first.

Required behavior tests:

1. canonical Completion stage is returned for an owned project;
2. Completion submission deadline is the authoritative V2 deadline when it conflicts with legacy Katedra `deadline`;
3. mentor waiting state comes from `completion_project_state`;
4. Completion tasks are returned in stable `created_at ASC` order;
5. an explicit foreign-user canonical project lookup cannot load workflow or downgrade to compatibility mode;
6. an owned project with no Completion state returns `legacy-compat` and `workflow: null`;
7. an authenticated user's legacy guest/opaque project with no canonical academic-project row returns `legacy-compat`;
8. a database error does not downgrade to compatibility mode;
9. `/api/state` uses the workflow module instead of directly querying `completion_*` tables;
10. production-derived DB types include the required canonical columns;
11. stale/legacy workflow data cannot be presented as `source: "completion"`.

Existing V2-001 gates remain mandatory:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Because `/api/state` changes, relevant browser/integration coverage must also be considered before merge.

## 15. Non-goals

V2-002 explicitly does not:

- migrate Completion write commands into Katedra;
- create dual writes between Katedra and Completion state;
- delete `katedra_projects` or existing Katedra state;
- rewrite `app/katedra-engine.js`;
- replace the PHASES checklist;
- add Pravo or another faculty;
- implement the Academic Context Compiler;
- change Lekta verification ownership;
- change payment/entitlement behavior;
- redesign project selection or multi-project UX.

## 16. Follow-up sequence

After V2-002:

1. V2-003 — canonical workflow commands/writes from Katedra into Completion-owned state.
2. V2-004 — extract legacy PHASES/checklist logic behind canonical workflow boundaries.
3. Academic Context Compiler — resolve institution/program/course/assessment rules and AI policy into project context.
4. Faculty expansion as data, beginning with Pravo only after the compiler boundary is proven.

## 17. Acceptance criteria

V2-002 is complete when all of the following are true:

- Katedra can expose canonical Completion workflow state for an owned project.
- Canonical Completion values are explicitly authoritative over conflicting legacy workflow values.
- A missing Completion row is explicit compatibility mode, not fabricated canonical state.
- A legacy guest/opaque project can remain functional in explicit compatibility mode without being mistaken for a canonical project.
- A DB failure fails closed.
- A foreign canonical project cannot be read or disguised as compatibility mode.
- Existing Katedra v1 state response remains backward compatible.
- Existing PUT behavior is unchanged.
- No new production schema/migration exists in Katedra.
- Unit tests, TypeScript, lint, build, DB authority guard, and relevant route/integration checks are green.
- No new workflow engine or duplicated Completion mutation domain is introduced.

## 18. Architectural decision

The defining V2-002 rule is:

> Katedra owns the workflow experience; Completion-owned shared persistence owns canonical workflow facts.

V2-002 establishes this rule for reads first. Writes move only after that read boundary is proven in production-compatible tests.
