# Hibridni agenticni workspace za `/pisi` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pretvoriti `/pisi` u state-based workspace koji nakon naplate vodi korisnika kroz pripremu materijala, autonomni agenticni tijek, intervenciju, pregled verificiranih sekcija i završno uređivanje rukopisa.

**Architecture:** Zadržati postojeći `WorkspaceClient`, Tiptap editor, IndexedDB storage i server-side agent run API, ali izvući state machine, agenticni draft i prikaz live previewa u male, testabilne module. Pripremni ekran koristi postojeće upload i mode kontrole. Pokrenuti run radi nad lokalno spremljenom privremenom granom; `WorkspaceClient` ga dohvaća pollingom, a glavni rukopis se mijenja samo kroz eksplicitni accept/merge.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tiptap 3, IndexedDB, postojeći `/api/agent-runs` i `/api/materials` endpointi, Vitest, Testing Library i Playwright browser E2E.

## Global Constraints

- Glavni rukopis ostaje local-first i nikada se tiho ne prepisuje agenticnim rezultatom.
- Read-only live preview prikazuje privremenu radnu verziju dok run traje.
- Rezultat se u glavni rukopis upisuje tek nakon korisnikove potvrde.
- `Prihvati sve provjerene` smije prihvatiti samo sekcije sa statusom `verified`.
- Blokirani ili zastarjeli rezultati ne ulaze u glavni rukopis.
- Uređivanje plana ili materijala nakon blokade stvara novu kontekstnu reviziju.
- Zatvaranje preglednika ne prekida server-side run; reload vraća zadnji checkpoint.
- Autonomni run može se pauzirati i nastaviti.
- Tema, vrsta rada i plaćeni opseg ostaju zaključani nakon naplate.
- Postojeća papir–tinta paleta, serifni identitet, plava i žuta ostaju.
- Motion mora poštovati `prefers-reduced-motion`.
- Lekta ostaje DOCX/compliance authority; ova promjena ne uvodi novu bazu ili migraciju izvan Lekta repozitorija.
- Ne dodavati novu UI biblioteku; koristiti postojeće React komponente i `pisi.css` tokene.

---

## Approved UX state mapping

Plan task coverage follows the approved design states exactly:

- **Priprema rada** is implemented in Task 2.
- **Autonomni tijek** and the **read-only live preview** are implemented in Task 3.
- **Intervencija** and context revision are implemented in Task 4.
- **Pregled rezultata** and safe section merge are implemented in Task 5.
- **Radni prostor** and the state-based shell are integrated in Tasks 6 and 7.
- Mobile layout, visual motion, dark mode, reduced motion and accessibility are covered in Tasks 6 and 8.

---

## Task 1: Workspace state machine i agentic draft contract

**Files:**
- Create: `lib/manuscript/workspace-state.ts`
- Create: `lib/manuscript/workspace-state.test.ts`
- Create: `lib/manuscript/agentic-revisions.ts`
- Create: `lib/manuscript/agentic-revisions.test.ts`
- Modify: `lib/manuscript/types.ts` — export shared revision/status types only when the new modules need them

**Interfaces:**

```ts
export type WorkspaceMode = 'preparation' | 'running' | 'intervention' | 'review' | 'writing'

export type WorkspaceRunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'blocked' | 'failed' | 'cancelled'

export interface WorkspaceRunSummary {
  runId: string
  status: WorkspaceRunStatus
  activeStepId?: string
  activeAgent?: string
  activeVerifier?: string
  verifiedSections: number
  blockedSections: number
  totalSteps: number
}

export interface AgenticSectionRevisionV1 {
  sectionId: string
  baseRevision: string
  proposedContent: TiptapNode
  status: 'generated' | 'verified' | 'blocked' | 'stale' | 'accepted' | 'rejected'
  verificationMessage?: string
  updatedAt: string
}

export interface AgenticDraftV1 {
  schemaVersion: 1
  projectId: string
  runId: string
  baseManuscriptUpdatedAt: string
  contextRevision: string
  sections: AgenticSectionRevisionV1[]
  createdAt: string
  updatedAt: string
}

export function deriveWorkspaceMode(input: {
  hasActiveRun: boolean
  run?: WorkspaceRunSummary | null
  hasPendingReview: boolean
  hasManuscript: boolean
}): WorkspaceMode
```

**Produces:** Pure mode derivation and local draft validation. No React, network or IndexedDB access.

- [ ] **Step 1: Write failing state derivation tests.** Cover no manuscript, no run, active run, paused run, blocked run, completed run with pending review, and completed run with no pending review.

```ts
it('maps a blocked run to intervention', () => {
  expect(deriveWorkspaceMode({
    hasActiveRun: true,
    run: { runId: 'run-1', status: 'blocked', verifiedSections: 1, blockedSections: 1, totalSteps: 4 },
    hasPendingReview: true,
    hasManuscript: true,
  })).toBe('intervention')
})
```

- [ ] **Step 2: Run the focused tests and confirm failure.**

Run: `npm.cmd run test:ci -- lib/manuscript/workspace-state.test.ts lib/manuscript/agentic-revisions.test.ts`

Expected: FAIL because the new pure functions and draft validator do not exist.

- [ ] **Step 3: Implement the smallest pure state machine and validator.** Normalize unknown server statuses to a safe `intervention`/`review` state rather than silently returning `writing`. Validate project ID, run ID, section IDs, schema version, Tiptap node shape and timestamps.

- [ ] **Step 4: Add revision transition helpers.** Implement:

```ts
createAgenticDraft(input: { projectId: string; runId: string; base: ManuscriptV1; now?: string }): AgenticDraftV1
upsertSectionRevision(draft: AgenticDraftV1, revision: AgenticSectionRevisionV1): AgenticDraftV1
markStaleRevisions(draft: AgenticDraftV1, manuscript: ManuscriptV1): AgenticDraftV1
acceptVerifiedSections(base: ManuscriptV1, draft: AgenticDraftV1, sectionIds?: string[]): ManuscriptV1
```

`acceptVerifiedSections` must reject blocked/stale sections and leave all other main-manuscript sections unchanged.

- [ ] **Step 5: Run focused tests.**

Run: `npm.cmd run test:ci -- lib/manuscript/workspace-state.test.ts lib/manuscript/agentic-revisions.test.ts`

Expected: all tests pass, including no-overwrite and stale-revision cases.

- [ ] **Step 6: Commit the isolated contract.**

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- lib/manuscript/workspace-state.ts lib/manuscript/workspace-state.test.ts lib/manuscript/agentic-revisions.ts lib/manuscript/agentic-revisions.test.ts lib/manuscript/types.ts
& $git commit -m "feat: add agentic workspace state and draft contract"
```

---

## Task 2: Preparation screen after active Pass

**Files:**
- Create: `app/pisi/components/agentic-preparation.tsx`
- Create: `app/pisi/components/agentic-preparation.test.tsx`
- Modify: `app/pisi/components/paid-project-setup.tsx`
- Modify: `app/pisi/components/material-library.tsx`
- Modify: `app/pisi/components/agent-team-selector.tsx`
- Modify: `app/pisi/pisi.css`

**Interfaces:**

```ts
export interface AgenticPreparationProps {
  manuscript: ManuscriptV1
  passActive: boolean
  busy: boolean
  materialIds: string[]
  onMaterialsChange: (materials: MaterialAssetV1[]) => void
  onStart: (input: { mode: AgentRunMode; sourcePolicy: AgentSourcePolicy; materialIds: string[] }) => void
  onOpenPass: () => void
}
```

`MaterialAssetV1` is the existing type from `lib/materials/types.ts`; the UI
may render a smaller view model but must preserve the server asset ID.

**Produces:** A full preparation view that owns no server state beyond upload callbacks. `PaidProjectSetup` becomes a compatibility wrapper and remains usable inside the project drawer during rollout.

- [ ] **Step 1: Write component tests for the locked and active states.** Assert that an inactive Pass shows the lock copy and does not render the run button; an active Pass renders upload, source policy, all three run modes, project summary, and `Pokreni izradu rada`.

```tsx
it('does not start a run before the Pass is active', async () => {
  render(<AgenticPreparation {...props} passActive={false} />)
  expect(screen.queryByRole('button', { name: /Pokreni izradu rada/i })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused component tests and confirm failure.**

Run: `npm.cmd run test:ci -- app/pisi/components/agentic-preparation.test.tsx app/pisi/components/paid-project-setup.test.tsx`

Expected: FAIL because the preparation component does not exist.

- [ ] **Step 3: Implement the preparation component.** Use the existing `MaterialLibrary`, `AgentTeamSelector` and Pass state. Add a visible locked-project summary with topic, work type, faculty/program and a copy that the topic cannot change after payment. Keep upload status, TTL/privacy disclosure and source policy visible.

- [ ] **Step 4: Make the primary action emit one typed start request.** The component must pass `mode`, `sourcePolicy`, `materialIds` and the current manuscript to the existing `POST /api/agent-runs?projectId=...` caller. Do not create a second network request for the same run.

- [ ] **Step 5: Add light/dark and responsive styles.** The preparation state uses open paper surfaces, thin rules, a clear primary action and no dense card grid. At mobile width, materials and run settings stack in that order.

- [ ] **Step 6: Run focused tests and commit.**

Run: `npm.cmd run test:ci -- app/pisi/components/agentic-preparation.test.tsx app/pisi/components/paid-project-setup.test.tsx app/pisi/components/material-library.tsx`

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- app/pisi/components/agentic-preparation.tsx app/pisi/components/agentic-preparation.test.tsx app/pisi/components/paid-project-setup.tsx app/pisi/components/material-library.tsx app/pisi/components/agent-team-selector.tsx app/pisi/pisi.css
& $git commit -m "feat: add agentic project preparation view"
```

---

## Task 3: Run polling and read-only live preview

**Files:**
- Create: `app/pisi/components/agentic-dashboard.tsx`
- Create: `app/pisi/components/agentic-dashboard.test.tsx`
- Create: `app/pisi/components/read-only-manuscript-preview.tsx`
- Create: `app/pisi/components/read-only-manuscript-preview.test.tsx`
- Create: `app/pisi/components/agentic-timeline.tsx`
- Create: `app/pisi/components/agentic-timeline.test.tsx`
- Modify: `app/pisi/components/agent-run-panel.tsx`
- Modify: `app/pisi/pisi.css`

**Interfaces:**

```ts
export interface AgenticDashboardProps {
  projectId: string
  runId: string
  baseManuscript: ManuscriptV1
  draft: AgenticDraftV1 | null
  onDraftChange: (draft: AgenticDraftV1) => void
  onPause: () => Promise<void>
  onResume: () => Promise<void>
  onCancel: () => Promise<void>
  onBlocked: (run: WorkspaceRunSummary) => void
}

export interface ReadOnlyManuscriptPreviewProps {
  manuscript: ManuscriptV1
  draft: AgenticDraftV1 | null
  activeSectionId?: string
  readOnly: true
}
```

**Produces:** A dashboard that polls the existing run GET endpoint every four seconds while mounted, renders the current run state, and stores a sanitized local draft. It must stop polling on unmount and abort stale requests.

- [ ] **Step 1: Write tests for timeline status and polling lifecycle.** Cover active agent/verifier, attempts `1/3`–`3/3`, blocked state, pause/resume controls, completed state and interval cleanup.

- [ ] **Step 2: Run focused tests and confirm failure.**

Run: `npm.cmd run test:ci -- app/pisi/components/agentic-dashboard.test.tsx app/pisi/components/agentic-timeline.test.tsx app/pisi/components/read-only-manuscript-preview.test.tsx`

Expected: FAIL because the new components do not exist.

- [ ] **Step 3: Implement a typed run polling hook inside `agentic-dashboard.tsx` or a focused `lib/agents/run-polling.ts`.** Normalize API rows into `WorkspaceRunSummary` and preserve the last good state when a transient GET fails. Display a non-blocking connection warning instead of resetting the run.

- [ ] **Step 4: Implement the read-only preview.** Render section headings and Tiptap content without an editable editor. The component accepts navigation and search but no `onChange` callback. Generated/verified section changes receive a short yellow highlight class that disappears after the transition.

- [ ] **Step 5: Implement the three-zone desktop layout.** Left timeline, center preview, right active-step detail. The right panel must show agent, verifier, attempt, source status, billing/loading state when available, and pause/resume actions.

- [ ] **Step 6: Add reduced-motion and dark-mode styles.** No animation may be required to understand status. Use text labels in addition to color and symbols.

- [ ] **Step 7: Run focused tests and commit.**

Run: `npm.cmd run test:ci -- app/pisi/components/agentic-dashboard.test.tsx app/pisi/components/agentic-timeline.test.tsx app/pisi/components/read-only-manuscript-preview.test.tsx app/pisi/components/agent-run-panel.test.tsx`

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- app/pisi/components/agentic-dashboard.tsx app/pisi/components/agentic-dashboard.test.tsx app/pisi/components/read-only-manuscript-preview.tsx app/pisi/components/read-only-manuscript-preview.test.tsx app/pisi/components/agentic-timeline.tsx app/pisi/components/agentic-timeline.test.tsx app/pisi/components/agent-run-panel.tsx app/pisi/pisi.css
& $git commit -m "feat: add live agentic dashboard and manuscript preview"
```

---

## Task 4: Intervention workspace and context revision

**Files:**
- Create: `app/pisi/components/agentic-intervention.tsx`
- Create: `app/pisi/components/agentic-intervention.test.tsx`
- Create: `lib/agents/context-revision.ts`
- Create: `lib/agents/context-revision.test.ts`
- Modify: `app/api/agent-runs/[runId]/context/route.js`
- Modify: `app/pisi/components/material-library.tsx`
- Modify: `app/pisi/components/agentic-dashboard.tsx`
- Modify: `app/pisi/pisi.css`

**Interfaces:**

```ts
export interface ContextRevisionInput {
  runId: string
  projectId: string
  manuscript: ManuscriptV1
  materialIds?: string[]
}

export interface ContextRevisionResult {
  contextRevision: string
  attachedMaterialIds: string[]
}

export function createContextRevision(input: { manuscript: ManuscriptV1; materialIds: string[]; now?: string }): string
```

**Produces:** A blocked-run intervention panel and one server request that re-uploads the revised manuscript context and optionally attaches newly uploaded materials to the active run.

- [ ] **Step 1: Write API contract tests.** Extend `app/api/agent-runs/context-route.test.js` to assert ownership, active-run checks, manuscript validation, bounded material IDs, and that the route does not accept raw arbitrary fields. Assert `409`/`503` behavior for stale or failed attachment.

- [ ] **Step 2: Run the route tests and confirm the material-attachment case fails.**

Run: `npm.cmd run test:ci -- app/api/agent-runs/context-route.test.js lib/agents/run-request.test.ts`

Expected: existing manuscript-only behavior passes; the new `materialIds` attachment assertion fails.

- [ ] **Step 3: Extend the context route with a bounded `materialIds` field.** Reuse `attachAgentPayloadsToRun`; require the run to remain active and owned by the authenticated user; reject a partial attachment so the UI cannot claim that all selected materials are attached.

- [ ] **Step 4: Implement context revision identity.** Derive a deterministic revision from run ID, manuscript `updatedAt`, and material IDs. Store only the validated manuscript in the existing private payload path; never put the full manuscript in a shared log.

- [ ] **Step 5: Implement the intervention panel.** Show the verifier reason, relevant step, current source warnings, material library, local outline controls and `Nastavi`. On continue, call the context endpoint, mark old draft sections stale, then resume the run.

- [ ] **Step 6: Add tests for the user flow.** Cover edit material → upload → context re-upload → resume, failed upload leaving the run paused, and a changed manuscript making the old proposal stale.

- [ ] **Step 7: Run focused tests and commit.**

Run: `npm.cmd run test:ci -- app/api/agent-runs/context-route.test.js lib/agents/context-revision.test.ts app/pisi/components/agentic-intervention.test.tsx`

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- app/api/agent-runs/[runId]/context/route.js app/api/agent-runs/context-route.test.js lib/agents/context-revision.ts lib/agents/context-revision.test.ts app/pisi/components/agentic-intervention.tsx app/pisi/components/agentic-intervention.test.tsx app/pisi/components/material-library.tsx app/pisi/components/agentic-dashboard.tsx app/pisi/pisi.css
& $git commit -m "feat: add blocked-run intervention flow"
```

---

## Task 5: Review queue and safe accept/merge

**Files:**
- Create: `app/pisi/components/agentic-review.tsx`
- Create: `app/pisi/components/agentic-review.test.tsx`
- Create: `lib/manuscript/agentic-merge.ts`
- Create: `lib/manuscript/agentic-merge.test.ts`
- Modify: `lib/manuscript/storage.ts`
- Modify: `app/pisi/components/workspace-client.tsx`
- Modify: `app/pisi/pisi.css`

**Interfaces:**

```ts
export interface AgenticReviewProps {
  manuscript: ManuscriptV1
  draft: AgenticDraftV1
  onAccept: (sectionIds?: string[]) => Promise<void>
  onEdit: (sectionId: string, content: TiptapNode) => void
  onReject: (sectionId: string) => void
}

export function mergeVerifiedAgenticSections(input: {
  manuscript: ManuscriptV1
  draft: AgenticDraftV1
  sectionIds?: string[]
}): { ok: true; manuscript: ManuscriptV1; acceptedSectionIds: string[] } | { ok: false; error: string }
```

**Produces:** A review queue with section-level acceptance and a safe `Prihvati sve provjerene` action. Every accepted merge creates a local snapshot before modifying the main manuscript.

- [ ] **Step 1: Write merge unit tests.** Cover accepting one verified section, accepting all verified sections, rejecting blocked/stale sections, section missing from the base manuscript, and snapshot creation before merge.

- [ ] **Step 2: Run focused merge tests and confirm failure.**

Run: `npm.cmd run test:ci -- lib/manuscript/agentic-merge.test.ts app/pisi/components/agentic-review.test.tsx`

Expected: FAIL because merge helpers and review UI do not exist.

- [ ] **Step 3: Implement merge as a pure function plus storage orchestration.** Use `store.snapshot(manuscript, reason)` before applying changes. Preserve all unaccepted sections and update only accepted sections with a fresh `updatedAt`.

- [ ] **Step 4: Implement review UI.** Show section status, generated content, verifier evidence, source links, and warnings. Disable accept for stale/blocked results. Provide both per-section actions and the all-verified action.

- [ ] **Step 5: Add undo and reload tests.** Verify an accepted merge can be undone through the existing snapshot/restore mechanism and survives IndexedDB reload.

- [ ] **Step 6: Run focused tests and commit.**

Run: `npm.cmd run test:ci -- lib/manuscript/agentic-merge.test.ts app/pisi/components/agentic-review.test.tsx lib/manuscript/storage.test.ts`

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- app/pisi/components/agentic-review.tsx app/pisi/components/agentic-review.test.tsx lib/manuscript/agentic-merge.ts lib/manuscript/agentic-merge.test.ts lib/manuscript/storage.ts app/pisi/components/workspace-client.tsx app/pisi/pisi.css
& $git commit -m "feat: add safe agentic review and merge"
```

---

## Task 6: State-based shell, mobile navigation and motion polish

This task is the **Visual and motion system** implementation checkpoint for
the approved paper–ink design.

**Files:**
- Modify: `app/pisi/components/workspace-shell.tsx`
- Modify: `app/pisi/components/workspace-navigation.tsx`
- Modify: `app/pisi/components/mobile-workspace-nav.tsx`
- Modify: `app/pisi/components/project-drawer.tsx`
- Modify: `app/pisi/components/workspace-shell.test.tsx`
- Modify: `app/pisi/components/workspace-navigation.test.tsx`
- Modify: `app/pisi/pisi.css`
- Modify: `app/globals.css` only if a shared theme token is required by `/pisi`

**Interfaces:**

```ts
export type WorkspaceView = 'preparation' | 'dashboard' | 'intervention' | 'review' | 'writing'

export interface WorkspaceShellProps {
  view: WorkspaceView
  onViewChange: (view: WorkspaceView) => void
  projectLocked: boolean
  activeAgentLabel?: string
  children: ReactNode
}
```

**Produces:** One shell whose header communicates project lock, Pass, save state, total words and current phase without forcing the user into a drawer to understand the project.

- [ ] **Step 1: Write shell tests for each view.** Assert the correct page landmark, mobile navigation labels, active phase, locked-project indicator, save status and export action.

- [ ] **Step 2: Run focused shell tests and confirm failure.**

Run: `npm.cmd run test:ci -- app/pisi/components/workspace-shell.test.tsx app/pisi/components/workspace-navigation.test.tsx`

Expected: FAIL for new view props and state-specific labels.

- [ ] **Step 3: Refactor the shell without removing legacy drawer capabilities.** Keep Plan, Sources, Mentor, Rules, Lekta and Help in the drawer, but make the current agentic phase accessible from the main shell.

- [ ] **Step 4: Implement mobile behavior.** Use one visible context at a time. Preparation, dashboard, intervention and review open as full-height views; writing keeps the existing editor-first layout. Ensure no horizontal overflow below 800 px.

- [ ] **Step 5: Add visual contract assertions.** Extend `pisi-visual-contract.test.ts` for state-specific classes, text labels, dark-mode tokens and reduced-motion selectors.

- [ ] **Step 6: Run component and visual tests and commit.**

Run: `npm.cmd run test:ci -- app/pisi/components/workspace-shell.test.tsx app/pisi/components/workspace-navigation.test.tsx app/pisi/pisi-visual-contract.test.ts`

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- app/pisi/components/workspace-shell.tsx app/pisi/components/workspace-navigation.tsx app/pisi/components/mobile-workspace-nav.tsx app/pisi/components/project-drawer.tsx app/pisi/components/workspace-shell.test.tsx app/pisi/components/workspace-navigation.test.tsx app/pisi/pisi.css app/pisi/pisi-visual-contract.test.ts
& $git commit -m "feat: make pisi shell state based and responsive"
```

---

## Task 7: Integrate the state machine into `WorkspaceClient`

**Files:**
- Modify: `app/pisi/components/workspace-client.tsx`
- Modify: `app/pisi/components/workspace-client.observability.test.js`
- Create: `app/pisi/components/agentic-workspace.integration.test.tsx`
- Modify: `lib/manuscript/storage.ts` only if draft persistence needs a focused method

**Interfaces:**

```ts
type AgenticWorkspaceState = {
  mode: WorkspaceMode
  runId: string | null
  run: WorkspaceRunSummary | null
  draft: AgenticDraftV1 | null
  lastContextRevision: string | null
}
```

**Produces:** The actual `/pisi` behavior. On active Pass it opens preparation; after start it switches to dashboard; blocked runs switch to intervention; completed runs switch to review; accepted results return to writing.

- [ ] **Step 1: Write integration tests for state transitions.** Cover:
  - active Pass → preparation;
  - start run → dashboard;
  - GET run returns blocked → intervention;
  - context edit and resume → dashboard;
  - completed verified run → review;
  - accept all verified → writing;
  - reload restores the active run and local draft.

- [ ] **Step 2: Run the integration tests and confirm failure.**

Run: `npm.cmd run test:ci -- app/pisi/components/agentic-workspace.integration.test.tsx app/pisi/components/workspace-client.observability.test.js`

Expected: FAIL because `WorkspaceClient` still renders editor first and keeps agentic setup inside `ProjectDrawer`.

- [ ] **Step 3: Add state refs and local draft loading.** Load the draft by `projectId` and `runId`, validate it, and fall back to a clean draft if it is malformed. Never put draft content in `/api/state` metadata payloads.

- [ ] **Step 4: Wire start, poll, pause, resume and cancel actions.** Reuse existing authenticated routes and preserve their error statuses: `401`, `402`, `403`, `409`, `429` and provider/`503` errors must become readable UI messages without resetting the manuscript.

- [ ] **Step 5: Wire intervention context updates.** On user plan/material edits, snapshot local state, POST validated context to the run endpoint, update `contextRevision`, mark stale proposals, and resume only after the upload succeeds.

- [ ] **Step 6: Wire review merge.** Use `mergeVerifiedAgenticSections`, snapshot before accepting, clear only accepted draft sections, and return to writing mode. Keep rejected or blocked sections in the run history.

- [ ] **Step 7: Run integration tests and commit.**

Run: `npm.cmd run test:ci -- app/pisi/components/agentic-workspace.integration.test.tsx app/pisi/components/workspace-client.observability.test.js`

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- app/pisi/components/workspace-client.tsx app/pisi/components/agentic-workspace.integration.test.tsx app/pisi/components/workspace-client.observability.test.js lib/manuscript/storage.ts
& $git commit -m "feat: integrate state-based agentic pisi workspace"
```

---

## Task 8: Accessibility, error states and browser E2E

**Files:**
- Create: `scripts/agentic-workspace-ui-e2e.mjs`
- Create: `app/pisi/components/agentic-accessibility.test.tsx`
- Modify: `scripts/agentic-workflow-e2e.mjs`
- Modify: `docs/release/STAGING_MONEY_FLOW.md`
- Modify: `docs/release/AGENTIC_STAGING_DEPLOY.md`

**Produces:** Release evidence that the visual state model is usable with keyboard, mobile layout, dark mode and real authenticated runs.

- [ ] **Step 1: Write accessibility tests.** Assert focus moves to intervention heading, live status uses `aria-live`, all icon-only buttons have labels, blocked status is not conveyed only by color, and reduced-motion stylesheet is present.

- [ ] **Step 2: Add route/UI error matrix tests.** Cover inactive Pass, empty wallet/`402`, AI policy `403`, stale context `409`, rate limit `429`, provider `503`, storage failure, malformed material and unavailable provider capability.

- [ ] **Step 3: Extend authenticated browser E2E.** Add these checkpoints to `scripts/agentic-workflow-e2e.mjs`:

```text
login → preparation screen → upload material → choose autonomous
→ start run → dashboard with read-only preview
→ blocked run fixture → edit material/plan → resume
→ completed run → accept one section → accept all remaining verified
→ writing editor → reload → local text remains
```

The real staging path must use configured Supabase/Stripe/Anthropic credentials. Unit tests may use deterministic mocked responses, but must not be reported as staging proof.

- [ ] **Step 4: Add mobile and dark-mode browser assertions.** Check viewport widths 390, 768 and 1440; assert no horizontal overflow, visible current phase, usable bottom navigation and readable text in both themes.

- [ ] **Step 5: Run the full local gate.**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

Expected: all commands pass. The agentic staging preflight remains required before any real browser run:

```powershell
npm.cmd run preflight:production
npm.cmd run preflight:agentic
npm.cmd run test:e2e:agentic
```

- [ ] **Step 6: Commit release evidence and docs.**

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- scripts/agentic-workspace-ui-e2e.mjs app/pisi/components/agentic-accessibility.test.tsx scripts/agentic-workflow-e2e.mjs docs/release/STAGING_MONEY_FLOW.md docs/release/AGENTIC_STAGING_DEPLOY.md
& $git commit -m "test: add agentic workspace release gate"
```

---

## Execution order and review checkpoints

1. Task 1: pure state and revision contract;
2. Task 2: preparation screen;
3. Task 3: dashboard and read-only preview;
4. Task 4: intervention and context revision;
5. Task 5: review and safe merge;
6. Task 6: shell, mobile and motion;
7. Task 7: `WorkspaceClient` integration;
8. Task 8: accessibility and release E2E.

After each task:

- run the task's focused tests;
- inspect the rendered affected state at desktop and mobile widths;
- request code review before beginning the next task;
- make one isolated commit;
- preserve unrelated dirty-worktree changes.

The implementation must not begin until this plan is explicitly accepted.

## Self-review

- Spec coverage: all five workspace states, read-only live preview, intervention editing, safe merge, responsive layout, motion, accessibility, errors and acceptance criteria map to Tasks 1–8.
- Placeholder scan: every implementation step has concrete files, interfaces, commands and expected outcomes.
- Type consistency: `WorkspaceMode`, `WorkspaceRunSummary`, `AgenticDraftV1` and `mergeVerifiedAgenticSections` are introduced in Task 1 and consumed by later tasks with the same names and fields.
- Scope: no database migration, provider implementation, DOCX certification or collaborative editing is added; those remain existing system boundaries.
