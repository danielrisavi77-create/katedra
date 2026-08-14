# `/pisi` Navigation Command Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Redesign the `/pisi` desktop and mobile navigation into a restrained editorial command bar without changing manuscript, AI, auth, Pass, project drawer, or DOCX behavior.

**Architecture:** Keep `WorkspaceShell` as the owner of workspace layout and callbacks, but move navigation markup into focused React components. The desktop header will expose project identity, active section/save context, and primary utilities; the mobile header will expose only identity/status plus an overflow menu, while the fixed bottom navigation will switch among the three workspace contexts. CSS changes remain scoped to `app/pisi/pisi.css` and use the existing semantic theme variables.

**Tech Stack:** Next.js React client components, TypeScript/TSX, scoped CSS, Vitest, React Testing Library, existing `ThemeToggle`, `FocusTrap` conventions, and the existing `/pisi` visual-contract tests.

## Global Constraints

- Rukopis, AI state, auth state, Pass state, project drawer, and DOCX export behavior must remain unchanged.
- Existing paper–ink palette, serif identity, blue active state, and yellow Katedra identity remain.
- No new icon library, no new global design-token system, and no changes outside `/pisi` navigation styles/components/tests except the implementation plan.
- The desktop nav uses three zones: identity, current context, and actions.
- Only `Izvezi DOCX` receives primary visual emphasis.
- Mobile shows one workspace context at a time and uses `Sadržaj`, `Rukopis`, and `Katedra` as the three bottom-nav destinations.
- Mobile secondary actions are available through one overflow menu and the bottom nav respects `env(safe-area-inset-bottom)`.
- Every interactive control has visible `:focus-visible`; Escape closes the overflow menu; reduced motion removes optional transitions.
- Dark mode must preserve readable text, active state, borders, and export-button contrast.

---

### Task 1: Add failing navigation component tests

**Files:**
- Create: `app/pisi/components/workspace-navigation.test.tsx`
- Modify: `app/pisi/components/workspace-shell.test.tsx`

**Interfaces:**
- `WorkspaceNavigation` will receive `projectTitle`, `activeSectionTitle`, `saveStatus`, `syncStatus`, `totalWords`, `account`, `onOpenTools`, and `onExport`.
- `MobileWorkspaceNav` will receive `activeMobileView` and `onMobileViewChange`.
- Tests will treat accessible names and callback behavior as the public contract; CSS class names are implementation details.

- [ ] **Step 1: Write the failing desktop-navigation tests**

Add tests that render the navigation with a project title, active section, saved state, account link, and callbacks. Assert that:

```tsx
expect(screen.getByRole('link', { name: /Katedra početna/i })).toBeInTheDocument()
expect(screen.getByText('Teorijski okvir')).toBeInTheDocument()
expect(screen.getByRole('status')).toHaveTextContent(/Spremljeno/i)
expect(screen.getByRole('button', { name: /Projekt/i })).toBeInTheDocument()
expect(screen.getByRole('button', { name: /Izvezi DOCX/i })).toBeInTheDocument()
```

Clicking `Projekt` and `Izvezi DOCX` must call their respective callbacks exactly once.

- [ ] **Step 2: Write the failing overflow-menu tests**

Assert that the mobile overflow trigger is initially closed, opens on click, exposes `Projekt` and `Izvezi DOCX`, closes on Escape, and calls the correct callback when an item is selected. The menu must have an accessible label such as `Dodatne radnje`.

- [ ] **Step 3: Write the failing mobile-navigation tests**

Render each `MobileView` and assert exactly one bottom item has `aria-current="page"`. Click `Katedra` and verify:

```tsx
expect(onMobileViewChange).toHaveBeenCalledWith('assistant')
```

Keep the existing shell test for the three workspace regions and merge duplicate assertions only when the new component tests cover the same public behavior.

- [ ] **Step 4: Run the focused tests and verify failure**

Run:

```powershell
npm.cmd run test:ci -- app/pisi/components/workspace-navigation.test.tsx app/pisi/components/workspace-shell.test.tsx
```

Expected result: the new tests fail because the navigation components and overflow behavior do not yet exist; existing unrelated tests must not be changed to hide the failure.

- [ ] **Step 5: Commit the red tests**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add app/pisi/components/workspace-navigation.test.tsx app/pisi/components/workspace-shell.test.tsx
& 'C:\Program Files\Git\cmd\git.exe' commit -m "test: define pisi navigation contract"
```

### Task 2: Extract the navigation React components

**Files:**
- Create: `app/pisi/components/workspace-navigation.tsx`
- Create: `app/pisi/components/mobile-workspace-nav.tsx`
- Modify: `app/pisi/components/workspace-shell.tsx`
- Modify: `app/pisi/components/workspace-navigation.test.tsx`

**Interfaces:**
- `WorkspaceNavigationProps`:

```ts
type WorkspaceNavigationProps = {
  projectTitle: string
  activeSectionTitle: string
  saveStatus: SaveStatus
  syncStatus: SyncStatus
  totalWords: number
  account?: ReactNode
  onOpenTools?: () => void
  onExport: () => void
}
```

- `MobileWorkspaceNavProps`:

```ts
type MobileWorkspaceNavProps = {
  activeMobileView: MobileView
  onMobileViewChange: (view: MobileView) => void
}
```

- `WorkspaceShell` continues to expose the existing `onExport`, `onOpenTools`, `account`, and `onMobileViewChange` props. No consumer outside `WorkspaceShell` changes its callback contract.

- [ ] **Step 1: Implement the desktop identity and context components**

Create `WorkspaceBrand` and `WorkspaceContext` inside `workspace-navigation.tsx`. `WorkspaceBrand` keeps the existing home link and yellow `K` mark. `WorkspaceContext` renders active section title plus the existing save status as a single compact status region. Preserve `role="status"`, `aria-live="polite"`, and the existing `data-state` values.

- [ ] **Step 2: Implement desktop actions**

Create `WorkspaceActions` with this order: word count, account/Pass node, `ThemeToggle`, `Projekt`, `Izvezi DOCX`. `Projekt` remains secondary; `Izvezi DOCX` remains the only primary button. Use accessible names that include the visible Croatian labels.

- [ ] **Step 3: Implement the mobile overflow menu**

Create a client component with local `open` state. The trigger is a native button with `aria-expanded` and `aria-controls`. The menu contains the existing account node, `Projekt`, and `Izvezi DOCX`; theme remains directly visible in the compact header. Close the menu on:

```tsx
useEffect(() => {
  if (!open) return
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setOpen(false)
  }
  document.addEventListener('keydown', closeOnEscape)
  return () => document.removeEventListener('keydown', closeOnEscape)
}, [open])
```

Use a document-level pointer handler or a small wrapper ref to close on outside pointer down. Do not introduce a second focus-trap implementation; if the menu becomes a modal sheet later, reuse the existing `FocusTrap` component.

- [ ] **Step 4: Implement the mobile bottom nav**

Create `MobileWorkspaceNav` with the three fixed destinations and small inline symbols made from text/inline SVG only. Each button retains the existing callback and sets `aria-current="page"` only for the active view.

- [ ] **Step 5: Wire `WorkspaceShell` to the new components**

Resolve `activeSectionTitle` from `manuscript.sections` using `manuscript.activeSectionId`, with `Radno poglavlje` as a fallback. Render the desktop and mobile navigation components while preserving the existing `.pis-columns` region markup and `data-mobile-view` behavior.

- [ ] **Step 6: Run focused tests and verify they pass**

Run:

```powershell
npm.cmd run test:ci -- app/pisi/components/workspace-navigation.test.tsx app/pisi/components/workspace-shell.test.tsx
```

Expected result: all focused navigation tests pass.

- [ ] **Step 7: Commit the component extraction**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add app/pisi/components/workspace-navigation.tsx app/pisi/components/mobile-workspace-nav.tsx app/pisi/components/workspace-shell.tsx app/pisi/components/workspace-navigation.test.tsx
& 'C:\Program Files\Git\cmd\git.exe' commit -m "feat: split pisi navigation into focused components"
```

### Task 3: Apply the editorial desktop and mobile visual system

**Files:**
- Modify: `app/pisi/pisi.css:221-270`
- Modify: `app/pisi/pisi.css:450-492`
- Modify: `app/pisi/pisi-visual-contract.test.ts`

**Interfaces:**
- Preserve existing class names for `.pis-topbar`, `.pis-brand`, `.pis-save-state`, `.pis-sync-state`, `.pis-topbar-actions`, `.pis-mobile-nav`, `.pis-toolbar-button`, and `.pis-export-button` where possible so other `/pisi` styles do not regress.
- Add scoped classes only for the new navigation subcomponents and overflow menu.

- [ ] **Step 1: Add failing visual-contract assertions**

Extend the visual contract test to require selectors for:

```ts
expect(css).toContain('.pis-workspace-nav-context')
expect(css).toContain('.pis-mobile-overflow')
expect(css).toContain('env(safe-area-inset-bottom)')
expect(css).toMatch(/prefers-reduced-motion: reduce/)
```

Add a dark-mode assertion for the overflow surface and primary export button, and a `:focus-visible` assertion for navigation controls.

- [ ] **Step 2: Run the visual-contract test and verify failure**

Run:

```powershell
npm.cmd run test:ci -- app/pisi/pisi-visual-contract.test.ts
```

Expected result: the new selectors fail before the CSS changes.

- [ ] **Step 3: Implement desktop layout styles**

Set the topbar to a stable 64 px three-zone grid. Use a centered context group with `min-width: 0`, a clipped project title, restrained spacing, and a compact save indicator. Keep the export button as the only filled primary action. Make the sync label secondary and hide it before primary actions at the existing 1100 px breakpoint.

Use the existing semantic variables (`--pis-bar-surface`, `--pis-line-strong`, `--pis-ink`, `--pis-muted`, `--pis-blue-dark`, `--pis-yellow`, `--pis-on-accent`) rather than adding global color literals.

- [ ] **Step 4: Implement mobile header, overflow menu, and bottom nav styles**

At `max-width: 800px`:

- keep the header compact with project-title ellipsis;
- hide full save/sync text and keep the dot indicator;
- keep theme visible;
- show the overflow trigger and menu with a paper surface, thin border, and no excessive radius;
- give each menu item at least a 44 px touch target;
- make the bottom nav `height: calc(52px + env(safe-area-inset-bottom))`, add `padding-bottom: env(safe-area-inset-bottom)`, and retain three equal columns;
- keep the active state as blue text plus a thin top marker;
- add bottom padding to the workspace content so the nav never covers the editor.

- [ ] **Step 5: Add focus, dark-mode, hover, and motion states**

Use one consistent focus ring for all navigation buttons. Provide dark-mode overrides for text, menu surface, borders, active marker, and export button. Add 180–240 ms transitions for opacity/color/transform only, then disable those transitions and menu transforms under `prefers-reduced-motion: reduce`.

- [ ] **Step 6: Run focused tests and verify they pass**

Run:

```powershell
npm.cmd run test:ci -- app/pisi/pisi-visual-contract.test.ts app/pisi/components/workspace-navigation.test.tsx
```

Expected result: visual-contract and navigation tests pass.

- [ ] **Step 7: Commit the scoped visual redesign**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add app/pisi/pisi.css app/pisi/pisi-visual-contract.test.ts
& 'C:\Program Files\Git\cmd\git.exe' commit -m "style: redesign pisi desktop and mobile navigation"
```

### Task 4: Verify responsive and regression behavior

**Files:**
- Modify only if a test exposes a navigation-specific regression: `app/pisi/components/*.test.tsx`, `app/pisi/pisi-visual-contract.test.ts`
- No new product behavior or unrelated refactor is allowed in this task.

**Interfaces:**
- All existing `WorkspaceShell` props and callback behavior remain unchanged.
- The new navigation is validated through public roles, labels, and callbacks rather than internal DOM layout assumptions.

- [ ] **Step 1: Run the full local quality gates sequentially**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

Run `typecheck` after `build`, not in parallel, because the Next.js generated type files can race when both commands write `.next/types`.

- [ ] **Step 2: Run the dependency audit**

Run:

```powershell
npm.cmd run audit:dependencies
```

Expected result: no navigation-related dependency is added and the audit remains clean.

- [ ] **Step 3: Inspect the final diff and status**

Run:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' diff --check HEAD~3..HEAD
& 'C:\Program Files\Git\cmd\git.exe' status --short
```

Expected result: no whitespace errors, no unrelated files staged, and only the intended navigation commits plus the approved spec/plan are present.

- [ ] **Step 4: Commit any test-only corrections**

If the previous steps require a navigation-specific test correction, run the focused test again and commit only those files:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add app/pisi
& 'C:\Program Files\Git\cmd\git.exe' commit -m "test: stabilize pisi navigation regression coverage"
```

Do not use this step to hide a failing quality gate or to include unrelated worktree changes.

## Self-review checklist

- Desktop identity, context, and actions are implemented by separate components.
- The mobile overflow has a complete open/close/Escape/outside-click contract.
- The three mobile destinations preserve existing `MobileView` values and callbacks.
- The existing account/Pass node is not reimplemented in navigation.
- No manuscript or AI text is added to navigation state.
- Dark mode, focus-visible, safe-area, and reduced-motion requirements each have a test or explicit CSS assertion.
- The plan does not require a new dependency or a database change.
