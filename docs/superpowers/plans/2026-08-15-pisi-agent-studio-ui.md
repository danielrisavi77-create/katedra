# `/pisi` Agent Studio UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Učiniti agentični proces glavnim, vidljivim `/pisi` iskustvom s jasnim ulazom, procesnim feedom i stalnim pregledom rukopisa.

**Architecture:** Zadržavamo postojeći `WorkspaceClient` state machine, `PaidProjectSetup` i agent-run komponente. Dodajemo eksplicitnu navigaciju `Radionica`, novu vizualnu školjku oko postojećeg procesa i verzioniramo workspace preference kako stari `writing` localStorage ne bi skrivao novi UI.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, postojeći `app/pisi/pisi.css`, Playwright za browser smoke provjeru.

## Global Constraints

- Admin override otključava capability, ali ne stvara zaseban admin-only UI.
- Rukopis ostaje local-only canonical sadržaj.
- Agentični rezultat ne prepisuje rukopis bez potvrde ili autonomnog načina.
- Existing landing, auth, legal, checkout i Lekta handoff ostaju nepromijenjeni.
- Svaka UI faza mora biti provjerena na `http://localhost:3000`.
- `prefers-reduced-motion` mora ukloniti neobavezne animacije.

---

### Task 1: Workspace preference migracija i zadani ulaz u Radionicu

**Files:**
- Modify: `lib/manuscript/workspace-view.ts`
- Modify: `app/pisi/components/workspace-client.tsx`
- Test: `lib/manuscript/workspace-view.test.ts`
- Test: novi `app/pisi/components/workspace-client-view.test.tsx` ako postojeći test harness podržava bootstrap; u suprotnom testirati čistu migracijsku funkciju u `workspace-view.test.ts`

**Interfaces:**
- `WorkspaceViewPreference` ostaje kompatibilan s vrijednostima `home`, `writing`, `agents`.
- Dodati `WORKSPACE_VIEW_VERSION = 'v2'` i funkciju `migrateWorkspaceView(value, hasLegacyValue)` koja za novi ključ vraća `agents`, a postojeći eksplicitni `writing` prihvaća samo kada je korisnik izravno otvorio Rukopis u istoj sesiji.

- [ ] **Step 1: Write the failing tests**

```ts
it('opens the agent studio when no new workspace preference exists', () => {
  expect(initialWorkspaceView({ needsOnboarding: false, persistedView: null })).toBe('agents')
})

it('preserves an explicit current-session writing choice', () => {
  expect(initialWorkspaceView({ needsOnboarding: false, persistedView: 'writing' })).toBe('writing')
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm.cmd exec vitest run lib/manuscript/workspace-view.test.ts --maxWorkers=1`

Expected: FAIL because the current default is `home`.

- [ ] **Step 3: Implement the minimal migration**

Change the default in `initialWorkspaceView` from `home` to `agents` for completed onboarding, keep `home` for onboarding, and replace the workspace storage prefix in `workspace-client.tsx` with `katedra_workspace_view_v2:`. Keep direct `Rukopis` navigation writing `writing` to the v2 key.

- [ ] **Step 4: Run focused tests and related component tests**

Run: `npm.cmd exec vitest run lib/manuscript/workspace-view.test.ts app/pisi/components/workspace-shell.test.tsx --maxWorkers=1`

Expected: PASS.

- [ ] **Step 5: Verify locally**

Open `http://localhost:3000/pisi`, refresh once, and confirm the main content has `data-workspace-view="preparation"` or `data-workspace-view="dashboard"`, not only `data-testid="pis-writing-frame"`.

---

### Task 2: Explicit `Radionica` navigation and editor escape hatch

**Files:**
- Modify: `app/pisi/components/project-navigation.tsx`
- Modify: `app/pisi/components/workspace-client.tsx`
- Modify: `app/pisi/components/project-navigation.test.tsx` or create it if absent
- Test: `app/pisi/components/workspace-shell.test.tsx`

**Interfaces:**
- Extend `ProjectNavItem` with `'studio'`.
- `projectNavigationDestination('studio')` returns `{ kind: 'agentic', phase: 'preparation' }`.
- `navigateProject('studio')` calls the existing `selectAgenticPhase('preparation')`.

- [ ] **Step 1: Write failing navigation tests**

```tsx
it('renders Radionica as a primary project destination', () => {
  render(<ProjectNavigation activeItem="studio" workType="z" onNavigate={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Radionica' })).toBeTruthy()
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm.cmd exec vitest run app/pisi/components/project-navigation.test.tsx app/pisi/components/project-navigation-routing.test.ts --maxWorkers=1`

Expected: FAIL because `studio` is not in the current item list or destination map.

- [ ] **Step 3: Implement navigation**

Add `['studio', 'Radionica']` before `writing` in `BASE_ITEMS`. Map it to the existing agentic preparation phase. Keep `writing` mapped to the current editor and do not remove any existing project tools.

- [ ] **Step 4: Run tests and verify keyboard semantics**

Run: `npm.cmd exec vitest run app/pisi/components/project-navigation.test.tsx app/pisi/components/project-navigation-routing.test.ts app/pisi/components/workspace-shell.test.tsx --maxWorkers=1`

Expected: PASS; `Radionica` has `aria-current="page"` when active and `Rukopis`/`Pisanje` still opens the editor.

- [ ] **Step 5: Verify locally**

At `http://localhost:3000/pisi`, click `Radionica`, then `Pisanje`. Confirm both views change without a full page reload and the local manuscript remains intact.

---

### Task 3: Agent Studio shell with live process and manuscript preview

**Files:**
- Create: `app/pisi/components/agent-studio-shell.tsx`
- Modify: `app/pisi/components/workspace-client.tsx`
- Modify: `app/pisi/components/paid-project-setup.tsx`
- Modify: `app/pisi/pisi.css`
- Test: `app/pisi/components/agent-studio-shell.test.tsx`
- Test: `app/pisi/components/paid-project-setup.test.tsx`

**Interfaces:**

```tsx
type AgentStudioShellProps = {
  manuscript: ManuscriptV1
  passActive: boolean
  phase: AgenticWorkspacePhase
  children: ReactNode
  onOpenWriting: () => void
}
```

The shell renders a heading `Radionica Katedre`, an activity-oriented intro, the existing agent content as the main process column, and a right `Rukopis uživo` preview with section list and word count. It does not own run state or manuscript mutation.

- [ ] **Step 1: Write failing component tests**

```tsx
it('shows the workshop process and manuscript preview', () => {
  render(<AgentStudioShell manuscript={manuscript} passActive phase="preparation" onOpenWriting={vi.fn()}><p>Proces</p></AgentStudioShell>)
  expect(screen.getByRole('heading', { name: 'Radionica Katedre' })).toBeTruthy()
  expect(screen.getByText('Rukopis uživo')).toBeTruthy()
  expect(screen.getByText('Proces')).toBeTruthy()
})
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm.cmd exec vitest run app/pisi/components/agent-studio-shell.test.tsx --maxWorkers=1`

Expected: FAIL because the shell does not exist.

- [ ] **Step 3: Implement the shell**

Use existing `countDocumentWords` and manuscript sections. Render a simple editorial activity header, `children` in the primary column, and a preview list showing each section title and status. Add one `Otvori rukopis` button. Do not use a new card-heavy skin.

- [ ] **Step 4: Integrate without duplicating agent logic**

Wrap the existing `PaidProjectSetup` in `AgentStudioShell` from `workspace-client.tsx`. Pass `passActive`, `agenticView`, and `openWriting` callback. Keep `PaidProjectSetup` responsible for preparation/dashboard/intervention/review.

- [ ] **Step 5: Add responsive CSS and run tests**

Add desktop two-column layout, collapse to one column below 900px, and reuse existing dark-mode variables. Add only short entrance transitions and a `@media (prefers-reduced-motion: reduce)` override. Run:

`npm.cmd exec vitest run app/pisi/components/agent-studio-shell.test.tsx app/pisi/components/paid-project-setup.test.tsx app/pisi/components/agentic-dashboard.test.tsx --maxWorkers=1`

Expected: PASS.

- [ ] **Step 6: Verify locally**

Open `http://localhost:3000/pisi` in admin session. Confirm the page shows `Radionica Katedre`, `Rukopis uživo`, the current agentic preparation, and a visible `Otvori rukopis` action. Start a test run only if staging/backend flags allow it.

---

### Task 4: Process visibility and release verification

**Files:**
- Modify: `app/pisi/components/agentic-dashboard.tsx` only if a process state is missing from the visible header
- Modify: `app/pisi/components/agentic-event-feed.tsx` only if labels need the agreed copy
- Create: `scripts/agent-studio-ui-smoke.mjs`
- Modify: `package.json`
- Test: `app/pisi/components/agentic-dashboard.test.tsx`

- [ ] **Step 1: Add a failing assertion for process visibility**

Extend the existing dashboard test to assert `Dnevnik nastanka rada`, the active agent, verifier attempt, and `Sljedeća radnja` appear in a running run.

- [ ] **Step 2: Run the focused test and verify failure if a label is missing**

Run: `npm.cmd exec vitest run app/pisi/components/agentic-dashboard.test.tsx --maxWorkers=1`

Expected: either PASS without code changes or a focused failure identifying the missing visible label.

- [ ] **Step 3: Make the smallest copy/layout correction**

Keep existing run data and only expose missing labels in the studio; do not change API contracts or billing behavior.

- [ ] **Step 4: Add browser smoke coverage**

Use the installed Playwright package in `scripts/agent-studio-ui-smoke.mjs` to open `/pisi`, assert `Radionica Katedre` and `Rukopis uživo`, click `Otvori rukopis`, assert `pis-writing-frame`, then return to `Radionica`.

- [ ] **Step 5: Run all quality gates**

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

- [ ] **Step 6: Verify local release behavior**

Run the dev server and smoke script against `http://localhost:3000`. Check desktop/mobile widths, light/dark mode, admin account, anonymous locked state, refresh behavior, and no horizontal overflow.

## Self-review

- The plan changes only `/pisi` workspace routing and presentation; no database or shared entitlement schema changes.
- Existing agent contracts, local manuscript storage and API routes remain the source of truth.
- Every new behavior has a focused test and a local verification step.
- No task requires a new dependency because Playwright is already installed.
