# `/pisi` Hardening, Accessibility and Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Stabilize `/pisi` so AI suggestions cannot cross section boundaries, local manuscript edits are not lost, project tools are keyboard-accessible, and the workspace receives a focused responsive/dark-mode polish.

**Architecture:** Keep the local-first manuscript model and existing React/Tiptap workspace. Move race and persistence rules into small pure helpers, then wire them into `WorkspaceClient`; keep the drawer and onboarding behavior in their existing components. Treat the editor as the source of truth and require a matching proposal section and revision before every application.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tiptap 3, IndexedDB, Vitest, Testing Library, existing CSS tokens.

## Global Constraints

- Manuscript text remains local-only; `/api/state` receives metadata only.
- AI never changes the manuscript without explicit user confirmation.
- No database migration or change to Lekta schema.
- Preserve `?tip`, `?screen=scan`, project IDs, Lekta handoff, existing palette, and existing route contracts.
- Follow TDD: every behavior change gets a failing regression test before production code.
- Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test:ci`, and `npm.cmd run build` before completion.

---

## Phase A — Functional and data hardening

### Task 1: Protect proposal application from section and request races

**Files:**
- Create: `lib/manuscript/proposal-guards.ts`
- Create: `lib/manuscript/proposal-guards.test.ts`
- Modify: `app/pisi/components/workspace-client.tsx`
- Modify: `app/pisi/components/manuscript-editor.tsx`
- Test: `app/pisi/components/workspace-client.observability.test.js`

**Interfaces:**
- `canApplyProposal(proposal, activeSectionId, currentContent)` returns `{ok:true}` or `{ok:false, reason}`.
- `isCurrentAiRequest(requestId, activeRequestId, activeSectionId, currentSectionId)` rejects late stream updates.
- `ManuscriptEditor` receives an apply request only when its `sectionId` matches the rendered section.

- [ ] Write tests for a proposal from another section, a changed revision, and a late request update.
- [ ] Run `npx vitest run lib/manuscript/proposal-guards.test.ts` and verify the new tests fail because the helper does not exist.
- [ ] Implement the pure guards and add an `AbortController` plus request ID ref in `WorkspaceClient`.
- [ ] Abort and invalidate the active request when changing, adding, removing, or restoring sections; clear pending apply requests at the same boundaries.
- [ ] Verify the focused tests pass and add source-contract assertions for section ID checks and abort cleanup.

### Task 2: Make local autosave and IndexedDB loading loss-resistant

**Files:**
- Create: `lib/manuscript/runtime-validation.ts`
- Create: `lib/manuscript/runtime-validation.test.ts`
- Modify: `lib/manuscript/storage.ts`
- Modify: `app/pisi/components/workspace-client.tsx`
- Modify: `lib/manuscript/storage.test.ts`

**Interfaces:**
- `validateStoredManuscript(value, projectId)` returns a valid `ManuscriptV1` or `null`.
- The store exposes `save` and `close` without changing the existing public API.

- [ ] Write tests for rejecting a malformed stored value and accepting a valid manuscript.
- [ ] Run the focused tests and verify failure before implementation.
- [ ] Validate loaded IndexedDB values before returning them; treat invalid data as missing and let migration recover.
- [ ] Add a shared save function and flush pending manuscript state on `pagehide`/unmount where the browser permits it; keep the 500 ms debounce for normal typing.
- [ ] Ensure restore/import clears proposal, selection, and apply state before replacing the manuscript.
- [ ] Run storage and workspace tests.

### Task 3: Harden import, metadata persistence, and user-visible failures

**Files:**
- Create: `lib/manuscript/import-validation.ts`
- Create: `lib/manuscript/import-validation.test.ts`
- Modify: `app/pisi/components/workspace-client.tsx`
- Modify: `app/pisi/components/project-drawer.tsx`

**Interfaces:**
- `validateTextImport(file)` returns a precise user-facing validation result without reading file contents.
- Existing `persistManifest` remains the compatibility writer for metadata.

- [ ] Write tests for valid `.txt`, valid `.md`, wrong extension, oversized file, and empty content handling.
- [ ] Run focused tests and verify red.
- [ ] Implement validation and catch both file-read and snapshot failures with visible error feedback.
- [ ] Persist compatible metadata whenever title, faculty, program, mentor, citation style, deadline, or profile changes.
- [ ] Verify import and metadata tests pass.

## Phase B — Accessibility and responsive behavior

### Task 4: Add keyboard-complete catalog comboboxes

**Files:**
- Create: `app/pisi/components/catalog-combobox.test.tsx`
- Modify: `app/pisi/components/onboarding-flow.tsx`
- Modify: `app/pisi/pisi.css`

- [ ] Write tests for ArrowDown/ArrowUp selection, Enter selection, Escape close, and `aria-activedescendant`.
- [ ] Run the focused test and verify red.
- [ ] Implement an active option index, keyboard handlers, stable option IDs, and outside-click close without changing free-text search or acronym resolution.
- [ ] Add visible focus styling and verify the focused tests pass.

### Task 5: Make project drawer and dialogs focus-safe

**Files:**
- Create: `app/pisi/components/focus-trap.tsx`
- Create: `app/pisi/components/focus-trap.test.tsx`
- Modify: `app/pisi/components/project-drawer.tsx`
- Modify: `app/pisi/components/pass-dialog.tsx`
- Modify: `app/pisi/pisi.css`

- [ ] Write tests for Escape close, initial focus, focus containment, and focus return for the drawer.
- [ ] Run focused tests and verify red.
- [ ] Implement a small reusable focus utility with no dependency addition; wire it to drawer and Pass dialog.
- [ ] Add dialog descriptions, visible focus rings, and prevent background scrolling while a modal is open.
- [ ] Run component tests and verify no existing modal behavior regresses.

### Task 6: Stabilize mobile workspace interactions

**Files:**
- Create: `app/pisi/components/mobile-workspace.test.tsx`
- Modify: `app/pisi/components/workspace-shell.tsx`
- Modify: `app/pisi/pisi.css`
- Modify: `scripts/academic-suite-browser-e2e.mjs`

- [ ] Write tests for switching among Sadržaj, Rukopis, and Katedra and for keeping the active view announced.
- [ ] Run focused tests and verify red.
- [ ] Add `aria-current`, safe focus behavior, and mobile labels without changing the desktop three-column structure.
- [ ] Extend the browser contract to verify no horizontal overflow, editor focus after returning to Rukopis, and drawer close on mobile.
- [ ] Run component tests and the available browser contract.

## Phase C — Visual and interaction polish

### Task 7: Improve hierarchy, dark mode contrast, and state feedback

**Files:**
- Create: `app/pisi/pisi-visual-contract.test.ts`
- Modify: `app/pisi/pisi.css`
- Modify: `app/pisi/components/workspace-shell.tsx`
- Modify: `app/pisi/components/manuscript-editor.tsx`
- Modify: `app/pisi/components/assistant-panel.tsx`

- [ ] Write source-contract tests for explicit dark-mode surfaces, focus-visible rules, reduced-motion rules, and non-overlapping mobile controls.
- [ ] Run the focused test and verify red for each missing contract.
- [ ] Improve token contrast for muted text, selects, inputs, proposals, status states, and modal backdrops in dark mode.
- [ ] Add restrained transitions for section changes, accepted proposals, save status, and drawer open/close; disable nonessential motion under `prefers-reduced-motion`.
- [ ] Make proposal status and save status visually distinct without adding new card/pill patterns.
- [ ] Verify the visual contract and browser smoke behavior.

### Task 8: Full regression and release verification

**Files:**
- Modify: `docs/stabilization-checklist.md`
- Modify: `docs/stabilization-report.md`

- [ ] Run `npm.cmd run typecheck`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run test:ci`.
- [ ] Run `npm.cmd run build`.
- [ ] Run the local browser contract if Playwright is available; otherwise record the exact environment blocker without claiming E2E completion.
- [ ] Update the stabilization documents with the verified A/B/C scope and any external staging checks that remain pending.
