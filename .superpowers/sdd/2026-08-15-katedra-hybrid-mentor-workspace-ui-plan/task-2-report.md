# Task 2 report — student-goal navigation and quieter topbar

## Status

Implemented and committed as a scoped UI-only change. The desktop workspace now provides a student-goal project navigation rail, while the topbar retains project identity, save/sync state, word count, account/theme access, overflow actions, and the single filled DOCX export action.

## Changed files

- `app/pisi/components/project-navigation.tsx` — new typed project navigation with ordered Croatian labels, one active item, and conditional Obrana item for završni/diplomski work.
- `app/pisi/components/project-navigation.test.tsx` — component coverage for active navigation and seminarski defense omission.
- `app/pisi/components/workspace-shell.tsx` — optional project navigation props and desktop frame around the existing landmark structure.
- `app/pisi/components/workspace-client.tsx` — derives active navigation state and routes navigation to existing home, writing, preparation, and drawer surfaces.
- `app/pisi/components/workspace-navigation.tsx` — removes phase/agent competition from the topbar and retains accessible overflow actions.
- `app/pisi/components/workspace-navigation.test.tsx` — validates the quiet topbar contract and overflow project action.
- `app/pisi/components/workspace-shell.test.tsx` — updates phase-label assertions that no longer belong in the topbar.
- `app/pisi/pisi.css` — desktop rail/frame layout and mobile-only hiding of the project navigation.
- `app/pisi/pisi-visual-contract.test.ts` — aligns visual-contract assertions with the project-navigation/quiet-topbar design.

`app/pisi/components/mobile-workspace-nav.tsx` was reviewed and intentionally left unchanged: it remains the only primary context switcher at the mobile breakpoint.

## Commands and results

- `npx.cmd vitest run app/pisi/components/project-navigation.test.tsx app/pisi/components/workspace-navigation.test.tsx` — RED observed: missing `ProjectNavigation` import and the existing visible agent label.
- `npx.cmd vitest run app/pisi/pisi-visual-contract.test.ts app/pisi/components/project-navigation.test.tsx app/pisi/components/workspace-navigation.test.tsx app/pisi/components/workspace-shell.test.tsx` — PASS, 20 tests.
- `npm.cmd run typecheck` — PASS.
- `npm.cmd run lint` — PASS.
- `npm.cmd run test:ci` — PASS, 144 files / 506 tests; 4 skipped.
- `npm.cmd run build` — PASS.
- `Invoke-WebRequest http://127.0.0.1:3000/pisi` — HTTP 200; Katedra markup present.

Vitest emits the pre-existing Vite native-config-loader deprecation warning; no test command failed because of it.

## Self-review

- Confirmed only the active desktop project item has `aria-current="page"`.
- Confirmed Obrana appears only for `z` and `d` projects and the navigation callback receives the exact item ID.
- Confirmed existing outline navigation, editor main, and assistant aside landmarks remain inside the desktop frame.
- Confirmed `.pis-project-nav` is hidden at `800px` and the existing mobile workspace navigation remains the only primary context switcher there.
- Confirmed save status retains `role="status"` and `aria-live="polite"`; ThemeToggle and Dodatne radnje remain accessible.
- Reviewed the staged scope and kept backend, auth, landing, legal, and unrelated dirty-worktree files untouched.

## Concerns

- `scripts/agentic-workspace-ui-e2e.mjs` cannot be executed locally without authenticated staging credentials. It also still targets the removed `Agenti` topbar button, so it needs a separate browser-E2E maintenance task rather than an unscoped change here.
