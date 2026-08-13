# `/pisi` Quiet Manuscript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Reduce the visual noise above the `/pisi` manuscript so the paper and writing area become the primary focus.

**Architecture:** Keep the existing navigation components and editor behavior, but remove the duplicated active-section context from the topbar. Preserve save/sync semantics as compact accessible indicators in the action zone. Apply the visual change through scoped `/pisi` CSS for the header, editor column, paper heading, and format toolbar.

**Tech Stack:** React/TypeScript, Tiptap, Vitest, React Testing Library, scoped CSS, existing paper–ink theme variables.

## Global Constraints

- The desktop header becomes approximately 56–60 px high.
- The active section is not duplicated in the topbar; the paper heading remains the primary section title.
- Save status remains available to assistive technology and visually recognizable as a discreet indicator.
- The document begins visibly earlier on desktop and mobile.
- The formatting toolbar remains available but reads as a thin text tool line, not a separate card or panel.
- Existing manuscript, autosave, AI, outline, project drawer, auth, Pass, DOCX export, dark mode, keyboard access, and reduced-motion behavior remain unchanged.
- No new dependency, database change, global token change, or unrelated page change.

---

### Task 1: Update the navigation/editor contract tests

**Files:**
- Modify: `app/pisi/components/workspace-navigation.test.tsx`
- Modify: `app/pisi/components/workspace-shell.test.tsx`
- Modify: `app/pisi/pisi-visual-contract.test.ts`

**Interfaces:**
- `WorkspaceNavigation` no longer requires `activeSectionTitle`.
- `WorkspaceShell` continues to accept the same public workspace callbacks and renders the paper heading through `ManuscriptEditor`.

- [ ] **Step 1: Replace the active-section topbar assertion with a non-duplication assertion**

Render `WorkspaceNavigation` with a project title and saved state. Assert the topbar contains the project identity and status, but does not render `Teorijski okvir` as a topbar context element. Keep assertions for `Projekt`, `Izvezi DOCX`, and callback behavior.

- [ ] **Step 2: Add visual-contract assertions for quiet spacing**

Require the CSS to contain the new compact selectors and values:

```ts
expect(css).toContain('.pis-section-heading')
expect(css).toContain('.pis-formatbar')
expect(css).toContain('top: 0')
expect(css).toContain('.pis-save-state .pis-save-label')
```

Retain dark-mode, focus-visible, safe-area, and reduced-motion assertions.

- [ ] **Step 3: Run focused tests and confirm the expected RED result**

Run:

```powershell
npm.cmd run test:ci -- app/pisi/components/workspace-navigation.test.tsx app/pisi/components/workspace-shell.test.tsx app/pisi/pisi-visual-contract.test.ts
```

Expected result: the updated contract fails because the current navigation still requires/renders the active section and the new CSS contract is not present.

- [ ] **Step 4: Commit the red contract**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add app/pisi/components/workspace-navigation.test.tsx app/pisi/components/workspace-shell.test.tsx app/pisi/pisi-visual-contract.test.ts
& 'C:\Program Files\Git\cmd\git.exe' commit -m "test: define quiet manuscript header contract"
```

### Task 2: Remove duplicated topbar context and compact save semantics

**Files:**
- Modify: `app/pisi/components/workspace-navigation.tsx`
- Modify: `app/pisi/components/workspace-shell.tsx`
- Modify: `app/pisi/components/manuscript-editor.tsx` only if the heading needs a semantic class adjustment

**Interfaces:**
- `WorkspaceNavigationProps` removes `activeSectionTitle`.
- `WorkspaceShell` remains compatible with `workspace-client.tsx` and does not change its external callback props.
- The save status continues to use `role="status"` and `aria-live="polite"`.

- [ ] **Step 1: Remove `WorkspaceContext` and its active-section prop**

Delete the topbar context block and stop resolving/passing `activeSectionTitle` from `WorkspaceShell`. Keep the brand and action zone intact.

- [ ] **Step 2: Move save and sync indicators into the action zone**

Render one compact save indicator before the word count. Keep the full Croatian save label in a child with class `pis-save-label` so CSS can visually hide it without removing it from the accessibility tree. Keep sync state as a compact dot/title or accessible label rather than a full sentence in the header.

- [ ] **Step 3: Preserve editor heading as the single section title**

Keep `ManuscriptEditor`’s `.pis-section-heading` and `h1` unchanged semantically. Do not add a second breadcrumb or section label to the topbar.

- [ ] **Step 4: Run focused tests and verify GREEN for the component contract**

Run:

```powershell
npm.cmd run test:ci -- app/pisi/components/workspace-navigation.test.tsx app/pisi/components/workspace-shell.test.tsx
```

Expected result: component tests pass with no duplicated active section and preserved callbacks/status semantics.

- [ ] **Step 5: Commit the markup change**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add app/pisi/components/workspace-navigation.tsx app/pisi/components/workspace-shell.tsx app/pisi/components/manuscript-editor.tsx
& 'C:\Program Files\Git\cmd\git.exe' commit -m "refactor: simplify pisi manuscript header markup"
```

### Task 3: Apply quiet manuscript spacing and toolbar styling

**Files:**
- Modify: `app/pisi/pisi.css`
- Modify: `app/pisi/pisi-visual-contract.test.ts`

**Interfaces:**
- Keep styles scoped to `.pis-*` selectors.
- Reuse existing semantic variables and existing dark-mode/reduced-motion conventions.

- [ ] **Step 1: Reduce header and editor-column height pressure**

Set the desktop topbar to 58 px, update the column height calculation to match, and reduce editor-column top padding from 38 px to approximately 20–24 px. Keep mobile header and bottom-nav safe-area calculations consistent.

- [ ] **Step 2: Quiet the paper heading**

Reduce the paper’s top padding, section-heading bottom spacing, and heading scale slightly. Keep the title readable and preserve word count/status information inside the paper without adding new panels.

- [ ] **Step 3: Turn the format toolbar into a thin text-tool line**

Remove its card-like negative margins and heavy surface treatment. Use a compact inline strip with thin borders, low padding, and `top: 0` when sticky. Keep all editor buttons, focus states, dark-mode contrast, and touch targets.

- [ ] **Step 4: Tune mobile spacing**

Reduce mobile paper top padding and format-toolbar height while keeping horizontal scrolling, keyboard-safe bottom navigation, and content clearance intact.

- [ ] **Step 5: Run focused visual and component tests**

Run:

```powershell
npm.cmd run test:ci -- app/pisi/pisi-visual-contract.test.ts app/pisi/components/workspace-navigation.test.tsx app/pisi/components/workspace-shell.test.tsx
npm.cmd run lint
```

Expected result: all focused tests and lint pass.

- [ ] **Step 6: Commit the visual refinement**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add app/pisi/pisi.css app/pisi/pisi-visual-contract.test.ts
& 'C:\Program Files\Git\cmd\git.exe' commit -m "style: quiet the pisi manuscript header"
```

### Task 4: Run regression gates

**Files:**
- No new files; modify only navigation-specific tests if a verified regression requires it.

- [ ] **Step 1: Run the complete quality gates sequentially**

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
npm.cmd run audit:dependencies
```

- [ ] **Step 2: Check the final diff**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' diff --check HEAD~3..HEAD
& 'C:\Program Files\Git\cmd\git.exe' status --short -- app/pisi docs/superpowers
```

Expected result: all gates pass, no whitespace errors exist, and only the intended `/pisi` header/editor files and plan/spec documents are changed or tracked by this task.

## Self-review checklist

- The active section is rendered only in the paper heading.
- The header no longer contains a full center context block.
- Save status remains accessible despite compact visual presentation.
- The format toolbar remains discoverable and functional.
- Desktop and mobile document start positions are both improved.
- No unrelated workspace, billing, auth, or editor behavior changed.
