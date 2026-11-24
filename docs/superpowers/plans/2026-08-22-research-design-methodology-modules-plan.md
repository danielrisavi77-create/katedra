# Research Design Canvas i Methodology Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Izgraditi stvarni local-first Research Design Canvas i Methodology Builder u `/pisi`, sa server-side capability gateom, lokalnim verzijama, ograničenim AI kontekstom i browser E2E dokazom.

**Architecture:** Istraživački plan je zaseban `ResearchPlanV1` artefakt spremljen u vlastiti IndexedDB database po canonical `projectId`; postojeći `ManuscriptV1` ostaje kompatibilan. Server capability endpoint koristi postojeći ownership, project-lock, entitlement, academic-context i admin-override sloj. UI je u Project Draweru i workspace dobiva plan preko lokalnog storea; AI i agenti dobivaju samo bounded serializer plana.

**Tech Stack:** Next.js 16, React 19, TypeScript, IndexedDB, Vitest, Testing Library, Playwright/browser E2E, postojeći Supabase SSR capability repository.

## Global Constraints

- `ResearchPlanV1` je local-only canonical artefakt po `projectId`; ne šalje se u `/api/state`.
- `seminarski` nema `research_design` ni `methodology` capability.
- `zavrsni` i `diplomski` mogu dobiti capabilityje samo uz verified academic profile, aktivni canonical Pass i `KATEDRA_RESEARCH_MODULES_ENABLED=true`; razvojni allowlisted admin override može testirati modul lokalno.
- Feature flag je u produkciji isključen dok staging ugovori i E2E nisu dokazani.
- `review` zahtijeva problem, cilj, istraživačko pitanje, dizajn, uzorak, operacionalizaciju, instrument, analizu, ograničenja i etiku.
- Hipoteze, varijable i slučajevi mogu biti prazni kada to odgovara dizajnu; svaki dodani zapis mora imati vrijednost.
- `approved` je dopušten samo iz valjanog `review` plana; svaka izmjena odobrenog plana vraća status u `draft` i stvara snapshot.
- AI nikada ne mijenja plan ili rukopis bez korisničke potvrde i snapshot-a.
- Ne uvoditi database migraciju u Katedru niti mijenjati canonical Lekta schema.
- Ne dodavati Research Design ili Methodology u javni Pass katalog dok lokalni i staging kriteriji nisu dokazani.

---

### Task 1: Research-plan contract, validation and transitions

**Files:**
- Create: `lib/research-plan/types.ts`
- Create: `lib/research-plan/validation.ts`
- Test: `lib/research-plan/validation.test.ts`

**Interfaces:**
- Produces `ResearchPlanV1`, `ResearchPlanFieldV1`, `ResearchPlanStatus`, `createEmptyResearchPlan(projectId, now?)`, `validateResearchPlan(value, projectId)`, `transitionResearchPlan(plan, nextStatus, now?)`.

- [ ] **Step 1: Write the failing validation tests**

```ts
it('accepts a complete review plan without requiring hypotheses for qualitative work', () => {
  const plan = completePlan({ projectId: 'project-1', status: 'review', hypotheses: [], variables: [] })
  expect(validateResearchPlan(plan, 'project-1')).toEqual({ ok: true, value: plan })
})

it('rejects a plan with another project id or missing review fields', () => {
  expect(validateResearchPlan(completePlan({ projectId: 'other', status: 'review' }), 'project-1')).toMatchObject({ ok: false })
  expect(validateResearchPlan(completePlan({ methodology: { analysis: '' }, status: 'review' }), 'project-1')).toMatchObject({ ok: false })
})

it('enforces the status state machine and invalidates approved edits', () => {
  const draft = createEmptyResearchPlan('project-1', '2026-08-22T10:00:00.000Z')
  expect(transitionResearchPlan(draft, 'review').ok).toBe(false)
  const review = completePlan({ projectId: 'project-1', status: 'review' })
  expect(transitionResearchPlan(review, 'approved', '2026-08-22T11:00:00.000Z')).toMatchObject({ ok: true, value: { status: 'approved' } })
  expect(transitionResearchPlan({ ...review, status: 'approved' }, 'draft').value?.status).toBe('draft')
})
```

- [ ] **Step 2: Run the focused test and confirm the expected missing-module failure**

Run: `npm.cmd exec vitest run lib/research-plan/validation.test.ts`

Expected: FAIL because `lib/research-plan/types.ts` and validation functions do not exist.

- [ ] **Step 3: Implement the minimal typed model and validation**

Use exact bounded limits: single text fields max 5,000 characters, repeated field values max 1,000 characters, maximum 20 repeated fields per collection. Return `{ ok: false, error: string }` for malformed input and `{ ok: true, value: ResearchPlanV1 }` for normalized input. `transitionResearchPlan` must reject `review` and `approved` when validation fails and must set a fresh `revision` and `updatedAt` for successful transitions.

- [ ] **Step 4: Run focused validation tests**

Run: `npm.cmd exec vitest run lib/research-plan/validation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only the isolated contract files if repository integration policy permits**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add lib/research-plan/types.ts lib/research-plan/validation.ts lib/research-plan/validation.test.ts
& 'C:\Program Files\Git\cmd\git.exe' commit -m "feat: add research plan contract"
```

If the shared dirty worktree prevents an isolated commit, leave the files uncommitted and record that in the task report.

### Task 2: Local IndexedDB persistence and plan snapshots

**Files:**
- Create: `lib/research-plan/storage.ts`
- Test: `lib/research-plan/storage.test.ts`

**Interfaces:**
- Produces `createResearchPlanStore({ databaseName? })` with `load(projectId)`, `save(plan)`, `snapshot(plan, reason)`, `listSnapshots(projectId)`, `restore(snapshot, projectId)` and `close()`.
- Uses database `katedra-research-plans`, version `1`, object stores `researchPlans` keyed by `projectId` and `researchPlanSnapshots` keyed by `id`.

- [ ] **Step 1: Write the failing IndexedDB tests**

```ts
it('saves and reloads a plan by canonical project id', async () => {
  const store = createResearchPlanStore({ databaseName: 'katedra-research-plans-test' })
  const plan = createEmptyResearchPlan('project-1', '2026-08-22T10:00:00.000Z')
  await store.save(plan)
  await expect(store.load('project-1')).resolves.toEqual(plan)
  store.close()
})

it('keeps only twenty newest snapshots and never restores another project', async () => {
  const store = createResearchPlanStore({ databaseName: 'katedra-research-plans-test' })
  const plan = createEmptyResearchPlan('project-1')
  for (let index = 0; index < 22; index += 1) await store.snapshot({ ...plan, revision: String(index), updatedAt: `2026-08-22T10:00:${String(index).padStart(2, '0')}.000Z` }, `snapshot-${index}`)
  expect(await store.listSnapshots('project-1')).toHaveLength(20)
  await expect(store.restore((await store.listSnapshots('project-1'))[0], 'project-2')).rejects.toThrow()
  store.close()
})
```

- [ ] **Step 2: Run the focused test and confirm the missing storage failure**

Run: `npm.cmd exec vitest run lib/research-plan/storage.test.ts`

Expected: FAIL because the research-plan store does not exist.

- [ ] **Step 3: Implement storage with validation at every boundary**

Import `fake-indexeddb/auto` only in the test file. Production storage must use browser `indexedDB`, validate loaded data with `validateResearchPlan`, clone values before writing, filter snapshots by project id, sort newest first, and delete entries after the twentieth. `restore` must reject a snapshot whose `projectId` differs from the requested project.

- [ ] **Step 4: Run focused storage tests**

Run: `npm.cmd exec vitest run lib/research-plan/storage.test.ts`

Expected: PASS.

- [ ] **Step 5: Run related manuscript storage tests**

Run: `npm.cmd exec vitest run lib/manuscript/storage.test.ts lib/research-plan/storage.test.ts`

Expected: PASS with no changes to existing manuscript storage behavior.

### Task 3: Server capability gate and read-only capability endpoint

**Files:**
- Modify: `lib/product/capabilities.ts`
- Modify: `lib/product/capabilities.test.ts`
- Modify: `lib/product/server-capabilities.ts`
- Modify: `lib/product/server-capabilities.test.ts`
- Create: `app/api/project-capabilities/route.js`
- Create: `app/api/project-capabilities/route.runtime.test.js`

**Interfaces:**
- Add `research_design` and `methodology` to the existing `ProjectCapability` union (they already exist in lifecycle types and must be made active only by this task).
- Add `researchModulesEnabled?: boolean` to `CapabilityContext`.
- Add `GET /api/project-capabilities?projectId=<uuid>` returning `{ projectId, capabilities: { research_design: boolean, methodology: boolean } }`.

- [ ] **Step 1: Write failing pure and route tests**

```ts
it('allows research capabilities only for paid verified tiers when the flag is enabled', () => {
  expect(decideProjectCapability({ userId: 'u', projectId: 'p', ownedProjectId: 'p', lockedProductKey: 'zavrsni', hasActivePass: true, verifiedAcademicProfile: true, researchModulesEnabled: true }, 'research_design')).toMatchObject({ allowed: true })
  expect(decideProjectCapability({ userId: 'u', projectId: 'p', ownedProjectId: 'p', lockedProductKey: 'seminarski', hasActivePass: true, verifiedAcademicProfile: true, researchModulesEnabled: true }, 'research_design')).toMatchObject({ allowed: false })
  expect(decideProjectCapability({ userId: 'u', projectId: 'p', ownedProjectId: 'p', lockedProductKey: 'diplomski', hasActivePass: true, verifiedAcademicProfile: true, researchModulesEnabled: false }, 'methodology')).toMatchObject({ allowed: false })
})
```

The route test must assert `401` for anonymous requests, `400` for a non-UUID project, and that it calls the capability repository with the canonical project id for both capability names.

- [ ] **Step 2: Run focused tests and verify they fail for the missing gate**

Run: `npm.cmd exec vitest run lib/product/capabilities.test.ts lib/product/server-capabilities.test.ts app/api/project-capabilities/route.runtime.test.js`

Expected: FAIL because the flag-aware decision and route do not exist.

- [ ] **Step 3: Implement the gate**

Add research capabilities to `PRODUCT_CAPABILITIES.zavrsni` and `.diplomski`, not `.seminarski`. `decideProjectCapability` must fail closed when either `verifiedAcademicProfile !== true` or `researchModulesEnabled !== true`. `resolveProjectCapability` passes `process.env.KATEDRA_RESEARCH_MODULES_ENABLED === 'true'`; the existing non-production allowlisted admin path remains an explicit override after ownership and can test locally. The route must use the authenticated Supabase client and never trust a tier, profile, or capability sent by the browser.

- [ ] **Step 4: Run focused capability tests**

Run: `npm.cmd exec vitest run lib/product/capabilities.test.ts lib/product/server-capabilities.test.ts app/api/project-capabilities/route.runtime.test.js`

Expected: PASS.

### Task 4: Research-plan UI panel and local interaction tests

**Files:**
- Create: `app/pisi/components/research-plan-panel.tsx`
- Create: `app/pisi/components/research-plan-panel.test.tsx`
- Modify: `app/pisi/pisi.css`

**Interfaces:**
- `ResearchPlanPanel` consumes `{ plan, academicContext, snapshots, onChange, onTransition, onRestore }` and emits normalized `ResearchPlanV1` values only through callbacks.
- The component renders `Research Design Canvas`, `Methodology Builder`, repeated field controls, status actions and local-only privacy copy.

- [ ] **Step 1: Write failing component tests**

```tsx
it('renders both builders and edits a repeated hypothesis', async () => {
  const onChange = vi.fn()
  render(<ResearchPlanPanel plan={createEmptyResearchPlan('project-1')} snapshots={[]} onChange={onChange} onTransition={vi.fn()} onRestore={vi.fn()} />)
  expect(screen.getByRole('heading', { name: 'Research Design Canvas' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Methodology Builder' })).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: /dodaj hipotezu/i }))
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ design: expect.objectContaining({ hypotheses: [expect.objectContaining({ value: '' })] }) }))
})

it('does not allow approval while required methodology fields are missing', () => {
  const onTransition = vi.fn()
  render(<ResearchPlanPanel plan={createEmptyResearchPlan('project-1')} snapshots={[]} onChange={vi.fn()} onTransition={onTransition} onRestore={vi.fn()} />)
  expect(screen.getByRole('button', { name: /odobri plan/i })).toBeDisabled()
})
```

- [ ] **Step 2: Run the component tests and confirm the missing-component failure**

Run: `npm.cmd exec vitest run app/pisi/components/research-plan-panel.test.tsx`

Expected: FAIL because the panel does not exist.

- [ ] **Step 3: Implement the accessible two-part form**

Use labels bound to inputs, `textarea` for long fields, fieldset/legend for repeated collections, visible status and inline validation. Use buttons `Dodaj hipotezu`, `Dodaj varijablu`, `Dodaj slučaj`, `Spremi nacrt`, `Pošalji na pregled`, `Odobri plan` and `Vrati zadnju verziju`. Keep the panel usable in light/dark mode and at 390px without horizontal overflow. Disable only actions that are invalid for the current state and expose the reason in text.

- [ ] **Step 4: Add focused styles and run component tests**

Run: `npm.cmd exec vitest run app/pisi/components/research-plan-panel.test.tsx`

Expected: PASS.

### Task 5: Workspace and Project Drawer integration

**Files:**
- Modify: `app/pisi/components/project-navigation-routing.ts`
- Modify: `app/pisi/components/project-drawer.tsx`
- Modify: `app/pisi/components/workspace-client.tsx`
- Modify: `app/pisi/components/project-drawer.test.tsx`
- Modify: `app/pisi/components/project-navigation-routing.test.ts`
- Create: `app/pisi/components/research-plan-workspace.test.tsx`

**Interfaces:**
- Add drawer tab `'research'` and label `Istraživački plan`.
- Export `ResearchPlanAccess = { research_design: boolean; methodology: boolean; allowed: boolean }` and `researchDrawerTabVisible(access: ResearchPlanAccess): boolean` from the routing helper.
- Workspace owns `researchPlan`, `researchPlanSnapshots`, `researchPlanAccess` and the debounced local save lifecycle.
- `ProjectDrawer` receives `researchPlanAccess`, plan callbacks and renders the panel only when access is allowed.

- [ ] **Step 1: Write failing integration tests**

```tsx
it('loads the local research plan and saves edits after the debounce', async () => {
  const store = createResearchPlanStore({ databaseName: 'workspace-research-test' })
  const plan = createEmptyResearchPlan('project-1')
  await store.save(plan)
  expect(await store.load('project-1')).toEqual(plan)
  store.close()
})

it('routes the research drawer tab without exposing it to a denied project', () => {
  expect(projectNavigationDestination('plan')).toEqual({ kind: 'drawer', tab: 'plan' })
  expect(researchDrawerTabVisible({ allowed: false })).toBe(false)
  expect(researchDrawerTabVisible({ allowed: true })).toBe(true)
})
```

- [ ] **Step 2: Run focused integration tests and confirm missing integration failure**

Run: `npm.cmd exec vitest run app/pisi/components/research-plan-workspace.test.tsx app/pisi/components/project-drawer.test.tsx app/pisi/components/project-navigation-routing.test.ts`

Expected: FAIL because the drawer tab, access state and workspace callbacks do not exist.

- [ ] **Step 3: Add drawer tab and workspace state**

On workspace mount, load the plan and snapshots using `createResearchPlanStore`. Fetch `/api/project-capabilities?projectId=...` after the manuscript and auth state are ready. Treat network errors as denied, display no research UI for denied access, and never use a client-supplied tier to override the response. Debounce saves by 500ms; set a visible local save status; snapshot before `review`, `approved`, restore and any edit from `approved`.

- [ ] **Step 4: Wire panel callbacks and restore behavior**

Use `transitionResearchPlan` for all status changes. On restore, write a new current revision rather than mutating the historical snapshot. Keep the existing manuscript snapshot and AI ledger behavior unchanged.

- [ ] **Step 5: Run focused integration tests**

Run: `npm.cmd exec vitest run app/pisi/components/research-plan-workspace.test.tsx app/pisi/components/project-drawer.test.tsx app/pisi/components/project-navigation-routing.test.ts`

Expected: PASS.

### Task 6: Bounded AI and agent context integration

**Files:**
- Create: `lib/research-plan/context.ts`
- Test: `lib/research-plan/context.test.ts`
- Modify: `lib/manuscript/context.ts`
- Modify: `lib/manuscript/context.test.ts`
- Modify: `lib/agents/run-request.ts`
- Modify: `lib/agents/provider-worker.ts`
- Modify: `lib/agents/provider-worker.test.ts`

**Interfaces:**
- Add `serializeResearchPlanContext(plan)` with the exact bounded result shape from the design spec.
- Extend `buildAiMessages` with optional `researchPlan?: ResearchPlanV1`.
- Extend validated agent context input with optional `researchPlan?: unknown`, normalize it using `validateResearchPlan`, and pass only the serialized result into provider input.

- [ ] **Step 1: Write failing context tests**

```ts
it('serializes only bounded research-plan fields', () => {
  const context = serializeResearchPlanContext(planWithVeryLongValues())
  expect(JSON.stringify(context).length).toBeLessThan(25_000)
  expect(context).not.toHaveProperty('projectId')
  expect(context).not.toHaveProperty('snapshots')
})

it('adds the research plan to AI context without adding manuscript text twice', () => {
  const messages = buildAiMessages({ ...baseInput, researchPlan: completePlan({ status: 'draft' }) })
  expect(messages[0].content).toContain('RESEARCH PLAN:')
  expect(messages[0].content).not.toContain('LOCAL SNAPSHOT')
})
```

- [ ] **Step 2: Run focused context tests and verify missing serializer failure**

Run: `npm.cmd exec vitest run lib/research-plan/context.test.ts lib/manuscript/context.test.ts lib/agents/provider-worker.test.ts`

Expected: FAIL because the serializer and new context plumbing do not exist.

- [ ] **Step 3: Implement bounded serialization and integrations**

Use a total serialized plan budget of 20,000 characters, trim single fields to 5,000, repeated values to 1,000, and include at most 20 repeated items. The serializer must strip ids, timestamps and private metadata. `buildAiMessages` adds the plan after `ACADEMIC CONTEXT` and before `OUTLINE`. Agent worker input uses the same serializer; a client-provided unverified academic profile or raw manuscript cannot override server-resolved context.

- [ ] **Step 4: Run focused context tests**

Run: `npm.cmd exec vitest run lib/research-plan/context.test.ts lib/manuscript/context.test.ts lib/agents/provider-worker.test.ts`

Expected: PASS.

### Task 7: Browser E2E, feature flag and release documentation

**Files:**
- Modify: `scripts/pisi-workspace-ui-e2e.mjs`
- Modify: `scripts/pisi-workspace-ui-e2e.test.js`
- Create: `scripts/research-plan-browser-e2e.mjs`
- Create: `scripts/research-plan-browser-e2e.test.js`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `docs/release/LOCAL_VERIFICATION_2026-08-22.md`
- Create: `docs/release/RESEARCH_PLAN_MODULES.md`

- [ ] **Step 1: Write the browser contract test before the runner**

```js
it('requires the research plan scenario to assert save, reload and responsive layout', () => {
  const source = readFileSync(join(process.cwd(), 'scripts/research-plan-browser-e2e.mjs'), 'utf8')
  expect(source).toContain('Research Design Canvas')
  expect(source).toContain('Methodology Builder')
  expect(source).toContain('reload')
  expect(source).toContain('KATEDRA_RESEARCH_MODULES_ENABLED')
  expect(source).toContain('390')
})
```

- [ ] **Step 2: Run the contract test and verify the missing-runner failure**

Run: `npm.cmd exec vitest run scripts/research-plan-browser-e2e.test.js`

Expected: FAIL because the browser runner does not exist.

- [ ] **Step 3: Implement the Playwright runner**

Use the existing local server and admin preview fixture. The runner must open `/pisi`, navigate to `Istraživački plan`, fill at least problem, research question, design, sample, analysis, limitations and ethics, add one hypothesis, save, reload, assert values persist, transition to review, assert the approval action, then check viewport widths 390 and 1440 for no horizontal overflow. If local auth/admin or feature-flag prerequisites are missing, exit with an explicit `BLOCKED_EXTERNAL` message instead of claiming success.

- [ ] **Step 4: Run browser and contract tests**

Run: `npm.cmd exec vitest run scripts/research-plan-browser-e2e.test.js`

Run: `npm.cmd run test:e2e:research-plan`

Expected: contract PASS; browser PASS with configured local admin, or explicit `BLOCKED_EXTERNAL` without false success.

- [ ] **Step 5: Document flag and release boundary**

Add `KATEDRA_RESEARCH_MODULES_ENABLED=false` to `.env.example` with a comment that production activation requires canonical entitlement and staging E2E. Document the local/admin verification result and the fact that public Pass copy remains unchanged until activation evidence exists.

### Task 8: Full quality gate and review checkpoint

**Files:**
- Modify only files required by previous tasks.

- [ ] **Step 1: Run focused module suite**

```powershell
npm.cmd exec vitest run lib/research-plan app/pisi/components/research-plan-panel.test.tsx app/pisi/components/research-plan-workspace.test.tsx app/api/project-capabilities/route.runtime.test.js
```

- [ ] **Step 2: Run root quality gates**

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

- [ ] **Step 3: Verify localhost**

```powershell
$response = Invoke-WebRequest -UseBasicParsing http://localhost:3000/pisi
if ($response.StatusCode -ne 200) { throw 'pisi nije dostupan' }
npm.cmd run test:e2e:research-plan
```

- [ ] **Step 4: Run diff and privacy checks**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' diff --check
rg -n "researchPlan|ResearchPlan" app/api/state/route.js app/api/analytics lib/observability
```

Expected: `/api/state` does not accept or serialize the full research plan; no plan text is written to operational logs.

- [ ] **Step 5: Update release evidence**

Record exact test counts, browser result, local feature-flag state and any staging blocker in `docs/release/LOCAL_VERIFICATION_2026-08-22.md`. Do not mark public Pass activation complete without canonical staging evidence.
