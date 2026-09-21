# Global Theme and Study Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Katedra follow the device light/dark preference with a persisted user override, and make a unique faculty acronym immediately reveal the relevant study profiles.

**Architecture:** A small client-only theme module owns resolution and persistence, while `ThemeProvider` writes the resolved theme to the document root. Existing styles consume semantic CSS variables, with Katedra’s scoped shell and `/pisi` mapping their local tokens to those variables. The catalog module gains pure resolution and compact-label helpers; onboarding consumes these helpers without changing server-side project metadata.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS custom properties, Vitest, Testing Library.

## Global Constraints

- The first theme follows `prefers-color-scheme` unless the user has saved an explicit override.
- Theme preference is browser-local; no database migration or `/api/state` field is added.
- Dark mode retains Katedra’s paper–ink identity, blue structure and yellow mark; it is not a pure-black skin.
- Existing auth, checkout, legal content and manuscript privacy behaviour must remain unchanged.
- `public/katedra-pack.json` remains the only academic catalog source.
- A non-catalog institution and program remain valid free-text values with no `unitId` or `profileId`.
- No new npm dependencies.
- Git is unavailable in the workspace, so verification is required but commits are not part of this execution.

---

### Task 1: Theme resolution and persistence

**Files:**
- Create: `lib/theme/theme.ts`
- Create: `lib/theme/theme.test.ts`

**Consumes:** browser `localStorage` and `matchMedia` through injectable parameters.

**Produces:** `Theme`, `resolveTheme`, `readStoredTheme`, `storeTheme` and `nextTheme` for React UI components.

- [ ] **Step 1: Write failing tests for precedence and toggle behaviour**

```ts
expect(resolveTheme({ stored: 'dark', prefersDark: false })).toBe('dark')
expect(resolveTheme({ stored: null, prefersDark: true })).toBe('dark')
expect(resolveTheme({ stored: 'invalid', prefersDark: false })).toBe('light')
expect(nextTheme('light')).toBe('dark')
```

- [ ] **Step 2: Run the theme unit test and confirm it fails because the module does not exist**

Run: `npm.cmd run test -- lib/theme/theme.test.ts`

Expected: failure that cannot resolve `./theme`.

- [ ] **Step 3: Implement the minimal pure theme API**

```ts
export type Theme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'katedra-theme'
export function resolveTheme(input: { stored: string | null; prefersDark: boolean }): Theme
export function nextTheme(theme: Theme): Theme
export function readStoredTheme(storage: Pick<Storage, 'getItem'>): Theme | null
export function storeTheme(storage: Pick<Storage, 'setItem'>, theme: Theme): void
```

Only `'light'` and `'dark'` are accepted stored values. Missing or malformed values defer to `prefersDark`.

- [ ] **Step 4: Run the unit test and confirm it passes**

Run: `npm.cmd run test -- lib/theme/theme.test.ts`

Expected: all theme tests pass.

### Task 2: Global provider and accessible theme switch

**Files:**
- Create: `app/theme-provider.jsx`
- Create: `app/theme-toggle.jsx`
- Create: `app/theme-provider.test.jsx`
- Modify: `app/layout.jsx`
- Modify: `app/globals.css`

**Consumes:** `Theme` helpers from `lib/theme/theme.ts`.

**Produces:** `ThemeProvider` around all application pages and `ThemeToggle` that can be inserted in page headers.

- [ ] **Step 1: Write a failing client-component test**

```jsx
render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
expect(document.documentElement.dataset.theme).toBe('dark')
await user.click(screen.getByRole('button', { name: /uključi svijetlu temu/i }))
expect(document.documentElement.dataset.theme).toBe('light')
expect(localStorage.getItem('katedra-theme')).toBe('light')
```

Mock `window.matchMedia` to prefer dark. Assert the accessible action describes the *next* theme, not only an icon.

- [ ] **Step 2: Run the component test and confirm it fails because the provider and switch do not exist**

Run: `npm.cmd run test -- app/theme-provider.test.jsx`

Expected: unresolved module failure.

- [ ] **Step 3: Implement provider and switch**

`ThemeProvider` resolves after mounting, writes `document.documentElement.dataset.theme`, and exposes `{ theme, setTheme }` through React context. It must listen to system theme changes only while no explicit stored preference exists. `ThemeToggle` calls `setTheme(nextTheme(theme))`, uses a visible sun/moon glyph and `aria-label` such as `Uključi svijetlu temu`.

- [ ] **Step 4: Mount the provider in the root layout and define semantic variables**

Wrap `AuthProvider` and all existing children in `ThemeProvider`. Add `color-scheme`, shared `--theme-*` variables, `[data-theme='dark']` overrides and dark-aware global scroll-to-top colours in `app/globals.css`. The initial HTML remains valid before JavaScript; a short inline no-flash script is not introduced in this task.

- [ ] **Step 5: Run the component test and confirm it passes**

Run: `npm.cmd run test -- app/theme-provider.test.jsx`

Expected: provider applies system preference, toggle updates the root attribute and persists the override.

### Task 3: Apply the semantic palette and expose the switch across Katedra

**Files:**
- Modify: `app/katedra-scoped.css`
- Modify: `app/pisi/pisi.css`
- Modify: `app/page.jsx`
- Modify: `app/prijava/page.jsx`
- Modify: `app/privatnost/page.jsx`
- Modify: `app/uvjeti/page.jsx`
- Modify: `app/racun/page.jsx`
- Modify: `app/registracija/page.jsx`
- Modify: `app/reset-lozinke/page.jsx`
- Modify: `app/zaboravljena-lozinka/page.jsx`
- Modify: `app/pisi/components/workspace-shell.tsx`
- Test: `app/theme-provider.test.jsx`
- Test: existing page source tests under `app/*.test.js` and `app/prijava/page.test.js`

**Consumes:** `ThemeToggle` and the root `data-theme` attribute from Task 2.

**Produces:** a consistent accessible switch in representative global headers and dark-compatible visual tokens for landing, auth/legal/account shell and manuscript workspace.

- [ ] **Step 1: Write failing source/component assertions for switch placement**

```js
expect(read('app/page.jsx')).toContain('ThemeToggle')
expect(read('app/prijava/page.jsx')).toContain('ThemeToggle')
expect(read('app/pisi/components/workspace-shell.tsx')).toContain('ThemeToggle')
```

Also extend the theme component test to render a switch inside the workspace top bar and verify its accessible name remains available.

- [ ] **Step 2: Run the affected tests and confirm placement assertions fail**

Run: `npm.cmd run test -- app/theme-provider.test.jsx app/prijava/page.test.js`

Expected: source assertions fail because headers have no theme switch.

- [ ] **Step 3: Map both style systems to semantic tokens**

In `katedra-scoped.css`, redefine the active `--bg`, `--bg2`, `--ink`, `--mut`, `--line`, `--acc` and panel colours from `--theme-*` variables rather than fixed light values. In `pisi.css`, define light and `[data-theme='dark']` values for every `--pis-*` token, including menus, paper, text selection, shadows, dialogs and input controls. Preserve contrast for blue links, yellow brand mark and errors.

- [ ] **Step 4: Insert `ThemeToggle` in headers without changing page actions**

Use the existing landing header, auth header, legal header, account header and Pisi top bar. On registration, password-reset and forgotten-password screens, add the toggle as a compact top-level utility control rather than changing authentication forms. Where an account page has no shared header, add the same minimal utility row. Ensure mobile rules allow the control to wrap before the primary action.

- [ ] **Step 5: Run placement and theme tests**

Run: `npm.cmd run test -- app/theme-provider.test.jsx app/prijava/page.test.js app/legal-summary-modal.test.js`

Expected: all tests pass and existing source-level shell assertions remain intact.

### Task 4: Canonical faculty resolution and compact study labels

**Files:**
- Modify: `lib/manuscript/academic-catalog.ts`
- Modify: `lib/manuscript/academic-catalog.test.ts`

**Consumes:** existing `AcademicCatalog`, `AcademicUnit`, `AcademicProfile` and `LegacyWorkType`.

**Produces:** `resolveUniqueAcademicUnit` and `displayAcademicProfile` for onboarding.

- [ ] **Step 1: Write failing catalog tests for an exact acronym and FPZG labels**

```ts
expect(resolveUniqueAcademicUnit(catalog, 'FPZG')?.id).toBe('fpzg')
expect(resolveUniqueAcademicUnit(catalog, 'fakultet političkih znanosti')?.id).toBe('fpzg')
expect(resolveUniqueAcademicUnit(catalog, 'fakultet')).toBeNull()
expect(displayAcademicProfile(finalPoliticalScience)).toBe('Politologija')
expect(displayAcademicProfile(finalJournalismText)).toBe('Novinarstvo — tekstualni')
```

- [ ] **Step 2: Run the catalog test and confirm it fails because the helpers do not exist**

Run: `npm.cmd run test -- lib/manuscript/academic-catalog.test.ts`

Expected: missing named export failure.

- [ ] **Step 3: Implement the two pure helpers**

`resolveUniqueAcademicUnit` uses the same normalized matching fields as `findAcademicUnits`, but returns a unit only when exactly one unit matches. `displayAcademicProfile` strips the leading faculty segment and trailing work-type wording from dot-separated labels. It retains a final differentiator such as `tekstualni` or `audiovizualni`, joins visible parts with an em dash and falls back to the original label when the pack does not follow this format.

- [ ] **Step 4: Run the catalog test and confirm it passes**

Run: `npm.cmd run test -- lib/manuscript/academic-catalog.test.ts`

Expected: acronym, ambiguity and compact-label cases pass.

### Task 5: Autofill the unique faculty and reveal concise study choices

**Files:**
- Modify: `app/pisi/components/onboarding-flow.tsx`
- Modify: `app/pisi/components/onboarding-flow.test.tsx`
- Modify: `app/pisi/pisi.css`

**Consumes:** `resolveUniqueAcademicUnit` and `displayAcademicProfile` from Task 4.

**Produces:** onboarding that selects a unique exact acronym/name without a click, clears stale profiles predictably and shows compact study labels.

- [ ] **Step 1: Write failing onboarding tests**

```tsx
await user.type(screen.getByLabelText(/fakultet ili ustanova/i), 'FPZG')
await waitFor(() => expect(screen.getByLabelText(/smjer.*studij/i)).toHaveValue(''))
expect(screen.getByRole('option', { name: /^Politologija$/i })).toBeInTheDocument()
expect(screen.getByRole('option', { name: /Novinarstvo — tekstualni/i })).toBeInTheDocument()
```

Add one test that changes a uniquely resolved faculty back to non-catalog text and asserts `profileId` is blank in `onComplete`.

- [ ] **Step 2: Run the onboarding test and confirm it fails**

Run: `npm.cmd run test -- app/pisi/components/onboarding-flow.test.tsx`

Expected: the study suggestions still require manual faculty selection or use long labels.

- [ ] **Step 3: Implement auto-resolution without overriding free text**

In `changeFaculty`, keep the typed value and resolve it against the loaded catalog. When one unit matches, set `unitId` to that unit, keep the readable institution name canonical and clear program/profile. When zero or multiple units match, clear only the IDs and preserve the text. When catalog loading completes, perform the same resolution once for any initial or already typed value.

- [ ] **Step 4: Render compact option labels and preserve canonical profile IDs**

Use `displayAcademicProfile(profile)` only for the option display and `aria-selected` comparison. On selection, store the full `profile.label` in local `program` and the original `profile.id` in `profileId`. Keep full free-text program support.

- [ ] **Step 5: Run onboarding and catalog tests**

Run: `npm.cmd run test -- app/pisi/components/onboarding-flow.test.tsx lib/manuscript/academic-catalog.test.ts`

Expected: existing free-text and canonical-ID tests plus new autofill/label tests pass.

### Task 6: Final verification

**Files:**
- Modify if needed: only files named by failing verification output.

**Consumes:** completed Tasks 1–5.

**Produces:** verified global theme and onboarding behaviour.

- [ ] **Step 1: Run static and full test gates**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Manually inspect representative pages in both themes**

Check `/`, `/prijava`, `/registracija`, `/zaboravljena-lozinka`, `/reset-lozinke`, `/racun`, `/privatnost`, `/uvjeti` and `/pisi` in light and dark themes. Confirm body text, borders, form controls, menus, the manuscript paper, dialogs and global scroll control remain readable. In `/pisi`, type `FPZG`, verify the degree-specific Politologija and Novinarstvo options appear without selecting the faculty suggestion, then switch to a custom faculty and verify free text remains usable.

- [ ] **Step 3: Record verification evidence in the completion report**

Report each command’s exit status and test count, list the affected files and state that no Git commit was created because Git is unavailable in this workspace.
