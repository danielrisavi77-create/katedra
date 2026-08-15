# Katedra hybrid mentor workspace UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementirati odobreni hybrid mentor workspace tako da Katedra cijelom korisničkom tijeku jasno pokazuje stanje projekta, jedan sljedeći korak i jednostavan put do pisanja.

**Architecture:** Postojeći Next.js/React UI ostaje osnova. `/pisi` dobiva project-home ulaz, ciljnu desktop navigaciju, trozonski editor i mobilne kontekste; postojeći local-first manuscript, auth, entitlement, checkout, agent API i Lekta handoff ostaju izvori ponašanja. Stilovi se konsolidiraju u postojeće brand tokene, bez novog HTML injection sloja i bez promjene shared Supabase sheme.

**Tech Stack:** Next.js 16, React 19, TypeScript/TSX, postojeći CSS tokeni, Tiptap editor, Vitest + Testing Library, Playwright browser smoke, postojeći light/dark `ThemeProvider`.

## Global Constraints

- Katedra ostaje content/process mentor, a Lekta ostaje DOCX/compliance authority.
- Rukopis ostaje local-only canonical sadržaj i ne ulazi u `/api/state` payload.
- AI ne mijenja rukopis bez korisničke potvrde ili jasno aktiviranog autonomnog načina rada.
- Autonomni način zadržava verifikator, source gate, quality gate i lokalni snapshot.
- Pass vrijedi za jedan `projectId`; tema, vrsta rada i plaćeni opseg ostaju zaključani nakon naplate.
- Postojeći auth, entitlement, checkout, legal, landing i Lekta handoff tokovi moraju ostati funkcionalni.
- Ne dodavati interne pojmove `Generator`, `Autopilot` ili `Agent dashboard` kao glavnu navigaciju.
- Desktop koristi tanku lijevu navigaciju; mobilni prikaz koristi samo `Pregled`, `Rukopis` i `Katedra` kao glavne kontekste.
- Motion traje približno 180–240 ms, nema beskonačnih dekorativnih animacija, a `prefers-reduced-motion` gasi neobavezne transformacije.
- Ne koristiti nove third-party UI biblioteke; Playwright je već dostupan u lockfileu i instalira se samo ako provjera pokaže da nedostaje.
- Svaka task faza završava ciljanim testom, kvalitetnim commitom i lokalnom provjerom prije sljedeće faze.

## Mapiranje postojećih datoteka

- `app/pisi/components/workspace-client.tsx` — orchestration stanja, onboarding, local autosave, editor, AI prijedlog, agenticni flow i drawer callbacki.
- `app/pisi/components/workspace-shell.tsx` — desktop/mobile struktura radnog prostora.
- `app/pisi/components/workspace-navigation.tsx` — trenutni topbar, account, statusi, tema i DOCX akcija.
- `app/pisi/components/mobile-workspace-nav.tsx` — mobilni kontekstualni switcher.
- `app/pisi/components/project-home.tsx` — trenutni projektni pregled i Completion Scan sažetak.
- `app/pisi/components/project-drawer.tsx` — plan, agenti, izvori, mentor, pravila, Lekta i pomoć.
- `app/pisi/components/assistant-panel.tsx` — kontekstualne AI naredbe i prijedlozi.
- `app/pisi/components/agentic-dashboard.tsx`, `agentic-preparation.tsx`, `agentic-intervention.tsx`, `agentic-review.tsx` — agenticni status, priprema, intervencija i review.
- `app/pisi/components/material-library.tsx` — prikaz materijala i statusa.
- `app/pisi/pisi.css` — lokalni `/pisi` tokeni, layout, dark mode, responsive pravila i motion.
- `app/globals.css` — globalni theme tokeni, theme toggle i globalni scroll-to-top.
- `app/katedra-scoped.css` — landing/auth/legal zajednički scoped stilovi; mijenjati samo kroz regression-testirani brand alignment.
- `app/racun/page.jsx`, `app/prijava/page.jsx`, `app/registracija/page.jsx`, `app/page.jsx` — account, auth i javni ulazni UI.
- `app/pisi/pisi-visual-contract.test.ts`, komponentni testovi i postojeći browser scripts — regression contract.

---

### Task 1: Konsolidirati UI tokene i vizualne primitive

**Files:**
- Modify: `app/pisi/pisi.css:1-55, 259-381, responsive and motion blocks`
- Modify: `app/globals.css:1-92`
- Test: `app/pisi/pisi-visual-contract.test.ts`
- Test: `app/theme-styles.test.js`

**Interfaces:**
- Produces CSS variables `--pis-bg`, `--pis-paper`, `--pis-paper-deep`, `--pis-ink`, `--pis-muted`, `--pis-line`, `--pis-line-strong`, `--pis-blue`, `--pis-blue-dark`, `--pis-yellow` in both light and dark themes.
- Produces layout primitives `.pis-surface`, `.pis-kicker`, `.pis-primary-button`, `.pis-secondary-button`, `.pis-status-dot` without changing existing component APIs.

- [ ] **Step 1: Write failing visual contract assertions.**

Add assertions to `app/pisi/pisi-visual-contract.test.ts`:

```ts
it('defines the hybrid workspace surface and navigation tokens', () => {
  expect(css).toContain('--pis-workspace-nav-width')
  expect(css).toContain('--pis-content-max')
  expect(css).toContain('.pis-project-nav')
  expect(css).toContain("html[data-theme='dark'] .pis-project-nav")
})

it('keeps reduced motion and visible focus contracts on the new primitives', () => {
  expect(css).toContain('.pis-primary-button:focus-visible')
  expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  expect(css).toContain('.pis-project-nav')
})
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run:

```powershell
npx vitest run app/pisi/pisi-visual-contract.test.ts
```

Expected: FAIL because the new token and navigation selectors do not yet exist.

- [ ] **Step 3: Implement the token layer and primitive states.**

Add to the existing `:root` and dark theme blocks without deleting the current variables:

```css
:root {
  --pis-workspace-nav-width: 178px;
  --pis-content-max: 1240px;
  --pis-control-height: 36px;
  --pis-focus-ring: 0 0 0 3px color-mix(in srgb, var(--pis-yellow), transparent 28%);
}

html[data-theme='dark'] {
  --pis-focus-ring: 0 0 0 3px color-mix(in srgb, var(--pis-yellow), transparent 18%);
}

.pis-primary-button:focus-visible,
.pis-secondary-button:focus-visible,
.pis-project-nav button:focus-visible {
  outline: 0;
  box-shadow: var(--pis-focus-ring);
}
```

Make the new primitives use the same serif/sans hierarchy, 2px maximum functional radius, and existing colors. Do not change landing selectors in this task.

- [ ] **Step 4: Run focused tests and theme regression.**

Run:

```powershell
npx vitest run app/pisi/pisi-visual-contract.test.ts app/theme-styles.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the isolated token change.**

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- app/pisi/pisi.css app/globals.css app/pisi/pisi-visual-contract.test.ts
& $git commit -m "refactor: establish mentor workspace UI tokens"
```

---

### Task 2: Dodati ciljnu desktop navigaciju i smiriti topbar

**Files:**
- Create: `app/pisi/components/project-navigation.tsx`
- Create: `app/pisi/components/project-navigation.test.tsx`
- Modify: `app/pisi/components/workspace-shell.tsx`
- Modify: `app/pisi/components/workspace-navigation.tsx`
- Modify: `app/pisi/components/workspace-navigation.test.tsx`
- Modify: `app/pisi/components/mobile-workspace-nav.tsx`
- Modify: `app/pisi/pisi.css`

**Interfaces:**

```ts
export type ProjectNavItem =
  | 'home'
  | 'plan'
  | 'sources'
  | 'writing'
  | 'mentor'
  | 'review'
  | 'lekta'
  | 'defense'
  | 'history'

export function ProjectNavigation(props: {
  activeItem: ProjectNavItem
  workType: 's' | 'z' | 'd'
  onNavigate: (item: ProjectNavItem) => void
}): JSX.Element
```

- [ ] **Step 1: Write failing component tests.**

Create tests that prove:

```tsx
it('renders student-goal navigation with one active item', () => {
  render(<ProjectNavigation activeItem="writing" workType="z" onNavigate={vi.fn()} />)
  expect(screen.getByRole('navigation', { name: 'Projekt' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Pisanje' }).getAttribute('aria-current')).toBe('page')
  expect(screen.queryByRole('button', { name: 'Generator' })).toBeNull()
})

it('hides defense for seminarski work', () => {
  render(<ProjectNavigation activeItem="home" workType="s" onNavigate={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Obrana' })).toBeNull()
})
```

Extend `workspace-navigation.test.tsx` so the topbar asserts only project identity, save status, words, account/theme and export/secondary actions; it must not require an always-visible agent label.

- [ ] **Step 2: Run focused tests to verify RED.**

```powershell
npx vitest run app/pisi/components/project-navigation.test.tsx app/pisi/components/workspace-navigation.test.tsx
```

Expected: the new component import/render assertions fail.

- [ ] **Step 3: Implement `ProjectNavigation`.**

Use the following ordered items and Croatian labels:

```ts
const BASE_ITEMS = [
  ['home', 'Početna'],
  ['plan', 'Plan'],
  ['sources', 'Literatura'],
  ['writing', 'Pisanje'],
  ['mentor', 'Mentor'],
  ['review', 'Revizija'],
  ['lekta', 'Provjera u Lekti'],
  ['history', 'Povijest'],
] as const
```

Insert `['defense', 'Obrana']` after `lekta` only for work types `z` and `d`. Render buttons with `aria-current="page"` only for the active item and call `onNavigate` with the exact item ID.

- [ ] **Step 4: Integrate navigation into `WorkspaceShell`.**

Add an optional `activeNavItem`, `onNavigate`, and `workType` prop. Render a desktop `<ProjectNavigation>` beside the existing content, while preserving the existing `main`, outline `nav`, editor `main` and assistant `aside` landmarks. Do not render the project navigation as a second mobile bottom bar.

Update `workspace-client.tsx` to derive `activeNavItem` from `view` and open the existing drawer/agent views through `onNavigate`; `writing` continues to render the editor.

- [ ] **Step 5: Reduce topbar competition and preserve mobile actions.**

Keep `Izvezi DOCX` as the only filled topbar action. Move project tools, agent controls, phase details and account overflow behind the existing secondary controls where the viewport requires it. Keep save status as `role="status"` with `aria-live="polite"`; keep `ThemeToggle` and `Dodatne radnje` accessible.

- [ ] **Step 6: Implement desktop/mobile CSS and run tests.**

Add `.pis-workspace-frame`, `.pis-project-nav`, `.pis-project-nav-list`, `.pis-project-nav button`, and a media query at `800px`. At desktop, use `grid-template-columns: var(--pis-workspace-nav-width) minmax(0, 1fr)` around the existing content. At mobile, hide `.pis-project-nav` and keep `.pis-mobile-nav` as the only primary context switcher.

Run:

```powershell
npx vitest run app/pisi/components/project-navigation.test.tsx app/pisi/components/workspace-navigation.test.tsx app/pisi/components/workspace-shell.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit.**

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- app/pisi/components/project-navigation.tsx app/pisi/components/project-navigation.test.tsx app/pisi/components/workspace-shell.tsx app/pisi/components/workspace-navigation.tsx app/pisi/components/workspace-navigation.test.tsx app/pisi/components/mobile-workspace-nav.tsx app/pisi/pisi.css
& $git commit -m "feat: add student-goal project navigation"
```

---

### Task 3: Uvesti jedinstveni projektni pregled i “Tvoj sljedeći korak”

**Files:**
- Create: `lib/project/next-action.ts`
- Create: `lib/project/next-action.test.ts`
- Create: `app/pisi/components/next-action-card.tsx`
- Create: `app/pisi/components/project-timeline.tsx`
- Create: `app/pisi/components/project-home.test.tsx`
- Modify: `app/pisi/components/project-home.tsx`
- Modify: `app/pisi/components/workspace-client.tsx`
- Modify: `app/pisi/pisi.css`

**Interfaces:**

```ts
export type NextAction = {
  title: string
  detail: string
  cta: string
  destination: 'writing' | 'preparation' | 'sources' | 'review' | 'lekta'
}

export function resolveNextAction(input: {
  stage: string
  totalWords: number
  sectionCount: number
  reviewSectionCount: number
  hasMaterials: boolean
  passActive: boolean
}): NextAction
```

- [ ] **Step 1: Write failing pure-function tests.**

Cover these exact cases:

```ts
expect(resolveNextAction({ stage: 'started', totalWords: 0, sectionCount: 1, reviewSectionCount: 0, hasMaterials: false, passActive: false }).destination).toBe('preparation')
expect(resolveNextAction({ stage: 'planned', totalWords: 0, sectionCount: 4, reviewSectionCount: 0, hasMaterials: true, passActive: true }).destination).toBe('writing')
expect(resolveNextAction({ stage: 'review', totalWords: 1200, sectionCount: 4, reviewSectionCount: 2, hasMaterials: true, passActive: true }).destination).toBe('review')
```

Add component assertions for exactly one primary CTA with the accessible name `Nastavi`, the active stage, word count, and no numeric readiness percentage.

- [ ] **Step 2: Run the focused tests and prove RED.**

```powershell
npx vitest run lib/project/next-action.test.ts app/pisi/components/project-home.test.tsx
```

- [ ] **Step 3: Implement `resolveNextAction`.**

Use deterministic project facts only. The priority order is: missing preparation → missing outline/material context → writing → review → Lekta. If `passActive` is false for a paid destination, return `preparation` with a contextual Pass CTA instead of silently presenting the paid operation as available.

- [ ] **Step 4: Split the visual card and timeline.**

`NextActionCard` consumes `NextAction` and exposes `data-primary-action="true"`. `ProjectTimeline` consumes an ordered list of `{ id, label, state }` and renders `ol`/`li` semantics. `ProjectHome` composes the two, keeps the existing Completion Scan data, and adds explicit material, deadline, mentor, Pass and Lekta summaries without creating a fake readiness score.

- [ ] **Step 5: Wire destinations.**

In `workspace-client.tsx`, route `writing` to the editor, `preparation` to the existing paid setup/drawer, and `sources`, `review`, and `lekta` to the corresponding project drawer tabs or agentic review view. Preserve `?tip=s|z|d`, `?screen=scan`, `projectId` and `#lekta=` behavior.

- [ ] **Step 6: Add responsive layout and verify.**

Use a two-column editorial layout above `900px` and one-column layout below it. The primary action remains first in DOM order and visible without horizontal scroll. Use a single timeline rule rather than three decorative cards.

```powershell
npx vitest run lib/project/next-action.test.ts app/pisi/components/project-home.test.tsx app/pisi/components/free-project-plan.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit.**

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- lib/project/next-action.ts lib/project/next-action.test.ts app/pisi/components/next-action-card.tsx app/pisi/components/project-timeline.tsx app/pisi/components/project-home.tsx app/pisi/components/project-home.test.tsx app/pisi/components/workspace-client.tsx app/pisi/pisi.css
& $git commit -m "feat: make project home action-led"
```

---

### Task 4: Uskladiti desktop tri-zone workspace i mobilne kontekste

**Files:**
- Modify: `app/pisi/components/workspace-shell.tsx`
- Modify: `app/pisi/components/workspace-shell.test.tsx`
- Modify: `app/pisi/components/mobile-workspace-nav.tsx`
- Modify: `app/pisi/components/workspace-client.tsx`
- Modify: `app/pisi/components/outline-panel.tsx`
- Modify: `app/pisi/components/manuscript-editor.tsx`
- Modify: `app/pisi/components/assistant-panel.tsx`
- Create: `app/pisi/components/assistant-panel.test.tsx`
- Modify: `app/pisi/pisi.css`

**Interfaces:**

```ts
export type MobileView = 'overview' | 'editor' | 'assistant'
```

The existing `'outline'` mobile value is migrated to `'overview'` at the boundary so saved local workspace preferences remain readable.

- [ ] **Step 1: Write failing layout/behavior tests.**

Extend `workspace-shell.test.tsx`:

```tsx
it('renders the student project navigation beside the three writing regions', () => {
  render(<WorkspaceShell /* complete test props */ />)
  expect(screen.getByRole('navigation', { name: 'Projekt' })).toBeTruthy()
  expect(screen.getByRole('navigation', { name: /struktura rada/i })).toBeTruthy()
  expect(screen.getByRole('main')).toBeTruthy()
  expect(screen.getByRole('complementary', { name: /katedra urednik/i })).toBeTruthy()
})
```

Add a mobile test proving `Pregled`, `Rukopis` and `Katedra` are the only buttons in the primary mobile nav and that `overview` maps to the overview context.

- [ ] **Step 2: Run focused tests and verify RED.**

```powershell
npx vitest run app/pisi/components/workspace-shell.test.tsx app/pisi/components/workspace-navigation.test.tsx
```

- [ ] **Step 3: Implement the shell frame.**

Keep existing outline/editor/assistant landmarks, but wrap them in `.pis-writing-frame` under the project navigation. Keep `home` and agentic screens in their own `main` landmark; do not duplicate a second `main` inside a displayed branch.

- [ ] **Step 4: Implement mobile context behavior.**

`MobileWorkspaceNav` emits labels `Pregled`, `Rukopis`, `Katedra`. `workspace-client.tsx` maps `overview` to project home when available, `editor` to the manuscript, and `assistant` to the Katedra panel. The editor remains the default when entering writing mode. Use `aria-current="page"` on exactly one mobile button.

- [ ] **Step 5: Refine outline, manuscript and assistant surfaces.**

Remove competing panel headings and repeated rounded containers. Keep section status, active section, word count, formatting, selection context and AI actions. Keep the editor paper surface visually dominant and constrain the right panel width so the editor does not collapse below `480px` at desktop.

- [ ] **Step 6: Add responsive and reduced-motion rules.**

At `max-width: 800px`, hide the desktop project navigation and non-active writing contexts; show the mobile nav above safe-area padding. At `max-width: 560px`, keep the paper padding readable and move the assistant to a full-height sheet. Add reduced-motion overrides for paper acceptance glow, drawer transition and panel enter animation.

- [ ] **Step 7: Run component tests and commit.**

```powershell
npx vitest run app/pisi/components/workspace-shell.test.tsx app/pisi/components/workspace-navigation.test.tsx app/pisi/components/manuscript-editor.test.ts app/pisi/components/outline-panel.test.tsx
```

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- app/pisi/components/workspace-shell.tsx app/pisi/components/workspace-shell.test.tsx app/pisi/components/mobile-workspace-nav.tsx app/pisi/components/workspace-client.tsx app/pisi/components/outline-panel.tsx app/pisi/components/manuscript-editor.tsx app/pisi/components/assistant-panel.tsx app/pisi/pisi.css
& $git commit -m "feat: shape responsive manuscript workspace"
```

---

### Task 5: Prevesti agente, materijale i projektni drawer u mentorski jezik

**Files:**
- Modify: `app/pisi/components/assistant-panel.tsx`
- Modify: `app/pisi/components/agentic-dashboard.tsx`
- Modify: `app/pisi/components/agentic-preparation.tsx`
- Modify: `app/pisi/components/agentic-intervention.tsx`
- Modify: `app/pisi/components/agentic-review.tsx`
- Modify: `app/pisi/components/agentic-timeline.tsx`
- Modify: `app/pisi/components/material-library.tsx`
- Modify: `app/pisi/components/project-drawer.tsx`
- Modify: `app/pisi/components/agentic-dashboard.test.tsx`
- Modify: `app/pisi/components/agentic-intervention.test.tsx`
- Modify: `app/pisi/components/agentic-review.test.tsx`
- Modify: `app/pisi/components/agentic-preparation.test.tsx`
- Modify: `app/pisi/pisi.css`

**Interfaces:**

Agent status components consume the existing run data and render a human-readable projection:

```ts
type AgentStatusSummary = {
  phaseLabel: string
  agentLabel: string
  verifierLabel: string
  attempt: 1 | 2 | 3
  state: 'preparing' | 'running' | 'ready' | 'blocked' | 'failed' | 'paused'
  nextAction: string
}
```

- [ ] **Step 1: Write failing copy and state assertions.**

Add tests that assert:

```tsx
expect(screen.getByText(/Analiza materijala|Literatura|Struktura|Plan|Pisanje|Provjera/i)).toBeTruthy()
expect(screen.getByText(/Pokušaj 1\/3/i)).toBeTruthy()
expect(screen.getByText(/verifikator/i)).toBeTruthy()
expect(screen.queryByText(/Agent dashboard|Generator|Autopilot/i)).toBeNull()
```

Add material tests for readable statuses `Čitamo`, `Pročitano`, `Potrebna provjera` and `Nije moguće pročitati`, including a retry action for failure.

- [ ] **Step 2: Run focused tests and verify RED.**

```powershell
npx vitest run app/pisi/components/agentic-dashboard.test.tsx app/pisi/components/agentic-intervention.test.tsx app/pisi/components/agentic-review.test.tsx app/pisi/components/agentic-preparation.test.tsx
```

- [ ] **Step 3: Add the human-readable phase projection.**

Create a pure mapping in `app/pisi/components/agentic-timeline.tsx` from agent IDs and verifier metadata to the Croatian phase labels. Keep provider IDs hidden. Show the agent and verifier as secondary metadata, not as navigation.

- [ ] **Step 4: Refine preparation, run and review states.**

Preparation explains the selected source policy and mode. Running shows progress, attempt, usage and pause action. Blocked shows the exact reason and user action. Review shows sources/evidence and `Pregledaj rezultat`, `Prihvati`, `Uredi` and `Odbaci` only when the contract permits them. Preserve server errors `401`, `402`, `403`, `429` and `503` as honest UI states.

- [ ] **Step 5: Reframe the drawer.**

Keep drawer tabs `Plan`, `Literatura`, `Mentor`, `Pravila`, `Lekta`, `Pomoć`; move agent status into the active process area rather than making `Agenti` a primary student goal. Existing material/source/mentor callbacks and local backup/restore must remain intact.

- [ ] **Step 6: Run tests and commit.**

```powershell
npx vitest run app/pisi/components/assistant-panel.test.tsx app/pisi/components/agentic-dashboard.test.tsx app/pisi/components/agentic-intervention.test.tsx app/pisi/components/agentic-review.test.tsx app/pisi/components/agentic-preparation.test.tsx app/pisi/components/project-drawer.test.tsx app/pisi/components/project-drawer.agentic.test.js
```

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- app/pisi/components/assistant-panel.tsx app/pisi/components/agentic-dashboard.tsx app/pisi/components/agentic-preparation.tsx app/pisi/components/agentic-intervention.tsx app/pisi/components/agentic-review.tsx app/pisi/components/agentic-timeline.tsx app/pisi/components/material-library.tsx app/pisi/components/project-drawer.tsx app/pisi/pisi.css
& $git commit -m "feat: express agents as mentor workflow"
```

---

### Task 6: Uskladiti paywall, account center i javne ekrane

**Files:**
- Modify: `app/pisi/components/pass-dialog.tsx`
- Modify: `app/pisi/components/paid-project-setup.tsx`
- Modify: `app/racun/page.jsx`
- Modify: `app/prijava/page.jsx`
- Modify: `app/registracija/page.jsx`
- Modify: `app/page.jsx`
- Modify: `app/katedra-scoped.css`
- Modify: `app/pisi/pisi.css`
- Test: `app/pisi/components/pass-dialog.test.tsx`
- Test: `app/pisi/components/paid-project-setup.test.tsx`
- Test: `app/racun/page.test.jsx`
- Test: `app/racun/page.runtime.test.jsx`
- Test: `app/landing-copy-contract.test.js`
- Test: `app/accessibility-contract.test.js`

**Interfaces:**
- `PassDialog` continues using the existing checkout callbacks and lock confirmation payload.
- Account page continues using authenticated account APIs and must not claim deletion succeeded while the canonical identity service is unavailable.

- [ ] **Step 1: Write failing copy/state assertions.**

Add assertions that:

```tsx
expect(screen.getByText(/ovaj projekt/i)).toBeTruthy()
expect(screen.getByText(/tema.*zaključ/i)).toBeTruthy()
expect(screen.queryByText(/odaberi jedan od tri nepovezana/i)).toBeNull()
```

For account, retain visible project/Pass/privacy headings and the honest deletion unavailable state. For landing, preserve the exact promise `Od teme do obrane`.

- [ ] **Step 2: Run focused tests to verify RED.**

```powershell
npx vitest run app/pisi/components/pass-dialog.test.tsx app/pisi/components/paid-project-setup.test.tsx app/racun/page.test.jsx app/racun/page.runtime.test.jsx app/landing-copy-contract.test.js
```

- [ ] **Step 3: Implement contextual Pass presentation.**

Use the existing canonical work type to show one relevant Pass, its included workflow and the pre-checkout lock warning. Keep the server as authority: UI changes to topic, work type or capability cannot bypass `409`, entitlement or lock checks.

- [ ] **Step 4: Reframe account and auth surfaces.**

Present account identity, project list, Pass summary, usage, Lekta status and privacy actions in that order. Keep withdrawal/deletion controls available but secondary. Registration copy must communicate that the same project is saved and continued, not that a new project is created.

- [ ] **Step 5: Align public/auth/legal visual primitives without landing rewrite.**

Use existing `--theme-*` and `.katedra-page` tokens for spacing, headings, focus rings and dark mode. Do not change public promise, legal content, auth logic or checkout metadata. Add a browser/DOM contract that the affected routes still expose one `main`, one `h1`, no horizontal overflow at mobile width, and no page errors.

- [ ] **Step 6: Run tests and commit.**

```powershell
npx vitest run app/pisi/components/pass-dialog.test.tsx app/pisi/components/paid-project-setup.test.tsx app/racun/page.test.jsx app/racun/page.runtime.test.jsx app/landing-copy-contract.test.js app/accessibility-contract.test.js
```

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- app/pisi/components/pass-dialog.tsx app/pisi/components/paid-project-setup.tsx app/racun/page.jsx app/prijava/page.jsx app/registracija/page.jsx app/page.jsx app/katedra-scoped.css app/pisi/pisi.css
& $git commit -m "feat: align account and contextual project access UI"
```

---

### Task 7: Browser QA, dark mode and release regression

**Files:**
- Modify: `scripts/agentic-workspace-ui-e2e.mjs`
- Create: `scripts/hybrid-mentor-ui-e2e.mjs`
- Create: `scripts/hybrid-mentor-ui-e2e.test.js`
- Modify: `docs/autonomous/AUTONOMOUS_AUDIT.md`
- Modify: `docs/autonomous/BLOCKERS.md` only if evidence changes an existing status

**Interfaces:**
- Browser script uses `KATEDRA_INTEGRATION_URL` when set and defaults to `http://localhost:3000` for local UI-only checks.
- It must never label authenticated backend/worker behavior as passing when staging credentials or canonical contracts are unavailable.

- [ ] **Step 1: Write script contract tests.**

Assert that the script checks the following route matrix:

```js
const routes = ['/', '/pisi', '/racun', '/prijava', '/registracija', '/privatnost', '/uvjeti']
const themes = ['light', 'dark']
const widths = [390, 768, 1440]
```

Assert that the script checks one `main`, one `h1`, no horizontal overflow, no uncaught page error, and `/pisi` project navigation labels in the authenticated/local project path.

- [ ] **Step 2: Verify Playwright availability.**

Run:

```powershell
npx playwright --version
```

If the command fails or the browser binary is missing, install the locked project dependency and browser before continuing:

```powershell
npm.cmd install --save-dev @playwright/test@1.61.1
npx playwright install chromium
```

Do not install another UI framework.

- [ ] **Step 3: Implement the browser journeys.**

The local journey must cover:

1. guest `/pisi?tip=d` onboarding;
2. faculty/program/topic entry and Completion Scan;
3. project overview and exactly one primary next action;
4. entry into writing workspace;
5. typed text autosave and reload;
6. desktop, tablet and mobile contexts;
7. light and dark mode;
8. open project drawer and Katedra panel;
9. no horizontal overflow and no browser errors.

Authenticated checkout, webhook, worker and provider claims remain staging-only and are reported separately as `BLOCKED_EXTERNAL` until configured.

- [ ] **Step 4: Run browser UI checks and inspect localhost.**

Start the existing server if it is not running:

```powershell
npm.cmd run dev
```

Run:

```powershell
node scripts/hybrid-mentor-ui-e2e.mjs
npm.cmd run test:e2e:agentic-ui
```

Review the actual desktop, 768px and 390px render for `/pisi`, `/racun`, `/prijava` and `/` in both themes. Fix any overflow, unreadable text, duplicated primary action or broken focus state before proceeding.

- [ ] **Step 5: Run complete quality gates.**

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

Expected: all pass; `audit:dependencies` and authenticated staging gates remain explicitly external if their services are unavailable.

- [ ] **Step 6: Update audit evidence and commit.**

Record route matrix, viewport matrix, themes, browser result and any external staging limitations in `docs/autonomous/AUTONOMOUS_AUDIT.md`. Do not mark G2–G10 as PASS based only on local UI smoke.

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- scripts/hybrid-mentor-ui-e2e.mjs scripts/hybrid-mentor-ui-e2e.test.js scripts/agentic-workspace-ui-e2e.mjs docs/autonomous/AUTONOMOUS_AUDIT.md
& $git commit -m "test: verify hybrid mentor workspace UI"
```

---

### Task 8: Controlled cleanup after parity

**Files:**
- Modify: `app/pisi/pisi.css`
- Modify: relevant `app/pisi/components/*.test.*`
- Test: full existing suite

- [ ] **Step 1: Search for obsolete primary UI vocabulary.**

```powershell
rg -n "Generator|Autopilot|Agent dashboard|skin|tramvaj" app/pisi
```

Only remove occurrences that are UI labels or dead styles; preserve API identifiers, compatibility adapters and tests that document server contracts.

- [ ] **Step 2: Remove only proven-dead styles.**

Use the browser route matrix and component render tree to remove selectors no longer referenced by the new workspace. Do not remove shared landing/auth/legal styles or any class still used by a test/runtime path.

- [ ] **Step 3: Run final focused and full gates.**

```powershell
npx vitest run app/pisi app/racun app/accessibility-contract.test.js app/landing-copy-contract.test.js
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

- [ ] **Step 4: Commit cleanup only if the diff is behavior-neutral.**

```powershell
$git='C:\Program Files\Git\cmd\git.exe'
& $git add -- app/pisi/pisi.css app/pisi
& $git commit -m "chore: remove obsolete workspace presentation styles"
```

## Review checkpoints

After Tasks 1–2, verify the new desktop navigation and topbar on localhost before touching project-home behavior. After Tasks 3–4, verify the complete `/pisi` journey at 390/768/1440 px in both themes. After Tasks 5–6, verify agent, paywall, account and auth states. Task 7 is the release-quality UI gate; Task 8 is optional cleanup and must not be used to hide unresolved behavior.

## Completion criteria

The UI work is complete only when the approved hybrid mentor experience is visible on localhost and verified by:

- targeted component and pure-function tests;
- full typecheck, lint, test and production build;
- browser checks across the specified routes, widths and themes;
- no new accessibility landmark, contrast or overflow regression;
- project home with one concrete next action;
- student-goal navigation without internal AI vocabulary;
- editor-first writing workspace with contextual Katedra panel;
- agent/material/paywall/account states that preserve the existing backend contracts.
