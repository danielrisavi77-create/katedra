# Katedra Landing Precision Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the existing production landing page so it feels more balanced and finished while preserving its current Katedra identity, structure, content, and behavior.

**Architecture:** Keep `/` server-rendered and keep the current landing markup structure. Remove the previous experimental landing CSS block and replace it with one consolidated scoped block. Add only a small client-only motion helper for progressive section reveals; CSS keeps all content visible when JavaScript is unavailable or motion is reduced.

**Tech Stack:** Next.js App Router, React JSX, scoped CSS in `app/katedra-scoped.css`, IntersectionObserver, CSS keyframes, Vitest, npm scripts.

## Global Constraints

- Keep the existing paper-and-ink palette, serif typography, blue accent, and overall Katedra character.
- Keep the current landing sections and Croatian copy as the baseline.
- Do not introduce a new visual system, new marketing claims, testimonials, logos, unsupported usage numbers, or a card-heavy SaaS layout.
- Establish consistent vertical rhythm without creating large empty dead zones.
- Use weight, line-height, and spacing instead of additional boxes to create hierarchy.
- Keep “Počni pisati” as the primary action and “Provjeri bez prijave” as the secondary action.
- Keep `/pisi`, `/pisi?screen=scan`, `/pisi?tip=s`, `/pisi?tip=z`, `/pisi?tip=d`, `/privatnost`, `/uvjeti`, and `/prijava` destinations unchanged.
- Keep visible `:focus-visible` states for every landing link.
- Stack hero actions and Pass cards cleanly on narrow screens.
- Prevent horizontal overflow and awkward price wrapping.
- Respect `prefers-reduced-motion` and keep important content visible without motion.
- Do not change `/pisi`, auth, checkout, webhook, account routes, environment files, dependencies, or external integrations.
- Do not add another demo route or duplicate the landing content model.

---

### Task 1: Normalize production landing markup and remove experimental inline styling

**Files:**
- Modify: `app/page.jsx`

**Interfaces:**
- Preserves all current visible copy, section order, prices, and href values.
- Preserves the existing `PASSES` data mapping.
- Produces stable landing hooks for the consolidated CSS:
  `.landing-page`, `.landing-header`, `.landing-hero`, `.landing-actions`,
  `.landing-primary-cta`, `.landing-secondary-cta`, `.landing-trust`,
  `.landing-steps`, `.landing-pricing`, `.landing-pass-card`,
  `.landing-final-cta`, and `.landing-footer`.

- [ ] **Step 1: Record the current landing link and content inventory**

  Confirm the current `PASSES` values and these destinations before editing:

  ```text
  /pisi
  /pisi?screen=scan
  /pisi?tip=s
  /pisi?tip=z
  /pisi?tip=d
  /privatnost
  /uvjeti
  /prijava
  ```

- [ ] **Step 2: Keep the existing section structure and add stable hooks**

  Keep the current header, hero, trust, three-step, pricing, closing CTA, and
  footer elements. Ensure each section uses the landing-specific class hooks
  listed above so the final CSS has one scoped target for each responsibility.

- [ ] **Step 3: Remove the inline pricing `<style>` block**

  Delete the inline `.landing-pass-card` style declaration from the pricing
  section. The same behavior will live in the consolidated scoped stylesheet,
  preventing duplicate sources of truth.

- [ ] **Step 4: Run the JSX verification**

  Run:

  ```powershell
  npm.cmd run typecheck
  ```

  Expected: exit code `0`; no route or JSX errors.

---

### Task 2: Add progressive landing motion with a regression test

**Files:**
- Create: `app/landing-motion.jsx`
- Create: `app/landing-motion.test.js`
- Modify: `app/page.jsx`

**Interfaces:**
- `LandingMotion` is a client component with no props and renders `null`.
- On mount it finds `[data-landing-motion]`, sets `data-motion-ready="true"`,
  and reveals `[data-reveal="true"]` elements using IntersectionObserver.
- If reduced motion is enabled or IntersectionObserver is unavailable, it sets
  `data-revealed="true"` on every reveal element immediately.

- [ ] **Step 1: Add reveal markers and a motion root to the landing markup**

  Add `data-landing-motion="true"` to the landing root and
  `data-reveal="true"` to the hero content, trust section, three workflow
  blocks, pricing section, closing CTA, and footer. Render `LandingMotion` once
  inside the root. Do not convert the whole page to a client component.

- [ ] **Step 2: Write the motion safeguard contract test first**

  Read `app/landing-motion.jsx` as text and assert it includes
  `IntersectionObserver`, `prefers-reduced-motion`, `data-motion-ready`,
  `data-revealed`, and the observer-unavailable fallback.

- [ ] **Step 3: Run the focused test and verify RED**

  Run:

  ```powershell
  npm.cmd test -- app/landing-motion.test.js
  ```

  Expected: FAIL because the helper does not exist yet.

- [ ] **Step 4: Implement the minimal helper**

  Use `useEffect` to set the root attribute, check
  `window.matchMedia('(prefers-reduced-motion: reduce)')`, reveal all elements
  for reduced motion or missing IntersectionObserver, and otherwise observe
  each reveal element with a modest threshold. Unobserve revealed elements and
  disconnect on cleanup.

- [ ] **Step 5: Run the focused test and verify GREEN**

  Run the same command. Expected: one motion contract test passes.

---

### Task 3: Consolidate the final landing visual polish

**Files:**
- Modify: `app/katedra-scoped.css`

**Interfaces:**
- Removes the old experimental `LANDING EDITORIAL POLISH` block and replaces it
  with one final `.katedra-page.landing-page` block.
- Does not alter unscoped workspace rules or styles for `/pisi`.

- [ ] **Step 1: Remove the previous landing-only CSS block**

  Delete the existing block beginning with `/* ---------- LANDING EDITORIAL
  POLISH ---------- */`, including its hero-card, trust-card, price-card, and
  related rules. Leave all non-landing application rules unchanged.

- [ ] **Step 2: Add the consolidated rhythm and typography rules**

  Add one scoped block that controls header padding, hero max-width and spacing,
  trust/steps/pricing section rhythm, section labels, paragraph measure, and
  footer spacing. Use only existing variables such as `--bg`, `--card`, `--line`,
  `--mut`, `--acc`, `--grad`, and `--serif`.

- [ ] **Step 3: Refine CTA and Pass interactions without adding new geometry**

  Keep the primary action filled with the existing gradient and the secondary
  action quiet. Add visible `:focus-visible` outlines, subtle arrow movement,
  and restrained Pass hover tint/lift. Do not add a new badge, card grid, or
  continuous animation.

- [ ] **Step 4: Add progressive reveal and reduced-motion rules**

  Hide reveal elements only after `.landing-page[data-motion-ready="true"]` is
  present, then show them with opacity/translate transitions when
  `data-revealed="true"` is set. Keep the default state visible without the
  attribute. Disable transitions and keyframes in
  `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 5: Add responsive rules**

  At `max-width: 560px`, stack hero actions, keep each action full width, make
  Pass cards one column, reduce only excessive spacing, and preserve footer
  readability. Verify no horizontal overflow is introduced.

- [ ] **Step 6: Run lint**

  Run:

  ```powershell
  npm.cmd run lint
  ```

  Expected: exit code `0`.

---

### Task 4: Verify the finished landing polish and scope safety

**Files:**
- Verify: `app/page.jsx`
- Verify: `app/landing-motion.jsx`
- Verify: `app/landing-motion.test.js`
- Verify: `app/katedra-scoped.css`

- [ ] **Step 1: Run all code gates**

  Run separately:

  ```powershell
  npm.cmd run typecheck
  npm.cmd run lint
  npm.cmd run test:ci
  npm.cmd run build
  ```

  Expected: all commands exit `0`; the suite includes the new motion test.

- [ ] **Step 2: Smoke-test production landing and CTA destinations**

  With the existing local dev server running:

  ```powershell
  $paths='/', '/pisi', '/pisi?screen=scan', '/pisi?tip=s', '/pisi?tip=z', '/pisi?tip=d', '/prijava', '/privatnost', '/uvjeti'
  foreach($path in $paths){
    $code=& curl.exe -s -o NUL -w '%{http_code}' ('http://localhost:3000' + $path)
    "$path=$code"
  }
  ```

  Expected: every path returns `200`.

- [ ] **Step 3: Verify the deletion and file scope**

  Confirm that `/demo/landing` returns `404` and that no runtime demo reference
  remains under `app` or `docs` outside this historical plan. Confirm
  `.env.local`, backend routes, dependencies, and `/pisi` engine files were not
  changed by this landing polish task. Git is unavailable, so record the
  explicit implementation file list in the handoff.
