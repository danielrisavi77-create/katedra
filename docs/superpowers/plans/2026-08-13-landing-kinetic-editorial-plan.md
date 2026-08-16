# Katedra Landing Kinetic Editorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the card-first landing treatment with an open editorial layout, animated process timeline, typographic Pass list, and restrained human-directed motion.

**Architecture:** Keep `/` server-rendered and preserve all existing links and factual copy. Add one small client-only `LandingMotion` component that only applies progressive-enhancement attributes to the landing root; CSS owns the animation, reduced-motion behavior, layout, and no-JavaScript fallback. Do not add an animation dependency.

**Tech Stack:** Next.js App Router, React JSX, scoped CSS in `app/katedra-scoped.css`, IntersectionObserver, CSS keyframes, Vitest, npm scripts.

## Global Constraints

- Keep the existing Katedra color tokens, paper background, serif identity, and Croatian copy.
- Use an asymmetrical editorial composition with deliberate whitespace and strong typographic hierarchy.
- Make **Počni pisati** the primary action, but present it as an editorial action link with an animated arrow/underline rather than a rounded SaaS pill.
- Keep **Provjeri bez prijave** as a quieter text action.
- Avoid a repeated grid of rounded rectangles, feature tiles, fake proof points, testimonials, logos, and unsupported marketing numbers.
- Preserve `/pisi`, `/pisi?screen=scan`, `/pisi?tip=s`, `/pisi?tip=z`, `/pisi?tip=d`, `/privatnost`, `/uvjeti`, and `/prijava` destinations.
- Do not change `/pisi`, auth, checkout, webhook, account routes, environment files, dependencies, or external integrations.
- Content remains visible if JavaScript or the observer is unavailable.
- All motion is disabled or reduced under `prefers-reduced-motion: reduce`.

---

### Task 1: Restructure the landing markup into editorial units

**Files:**
- Modify: `app/page.jsx`

**Interfaces:**
- Preserves the existing `PASSES` data, price strings, factual copy, and all
  current href values.
- Produces these stable hooks for CSS and motion:
  `.landing-page`, `.landing-hero`, `.landing-hero-kicker`,
  `.landing-actions`, `.landing-primary-cta`, `.landing-secondary-cta`,
  `.landing-trust`, `.landing-timeline`, `.landing-timeline-item`,
  `.landing-price-list`, `.landing-price-row`, `.landing-final-cta`.
- Adds `data-landing-motion="true"` to the landing root and
  `data-reveal="true"` to timeline items and price rows.

- [ ] **Step 1: Preserve the current link and copy inventory**

  Before editing, confirm the current `PASSES` entries and anchors. Keep the
  existing `tip` values and the exact destinations listed in the global
  constraints.

- [ ] **Step 2: Replace the card-first hero shell with open editorial markup**

  Keep the headline and supporting paragraph, add a small truthful kicker using
  the existing “Od teme do obrane” descriptor, and keep the two CTA anchors.
  Remove the hero card class/background treatment. Put the primary arrow in a
  span with a dedicated class so CSS can animate it without changing the URL.

- [ ] **Step 3: Replace the three-step grid with semantic timeline items**

  Use three `<article className="landing-timeline-item" data-reveal="true">`
  elements. Each article contains an open number marker, a short heading, and
  the existing explanatory copy. Do not introduce a feature-card wrapper.

- [ ] **Step 4: Replace Pass cards with linked price rows**

  Use a `.landing-price-list` wrapper and one linked `.landing-price-row` per
  Pass. Each row contains the name/description group, price, and an arrow span.
  Preserve `/pisi?tip=s`, `/pisi?tip=z`, and `/pisi?tip=d` exactly.

- [ ] **Step 5: Add the motion component mount and run typecheck**

  Import `LandingMotion` from `./landing-motion` and render it once inside the
  landing root. Run:

  ```powershell
  npm.cmd run typecheck
  ```

  Expected: exit code `0`.

---

### Task 2: Add progressive-enhancement motion behavior

**Files:**
- Create: `app/landing-motion.jsx`
- Create: `app/landing-motion.test.js`

**Interfaces:**
- `LandingMotion` is a client component with no props and renders `null`.
- On mount it sets `data-motion-ready="true"` on the nearest
  `[data-landing-motion]` root, observes `[data-reveal]` children, and sets
  `data-revealed="true"` once each enters the viewport.

- [ ] **Step 1: Write a source contract test for motion safeguards**

  Read `app/landing-motion.jsx` as text and assert it contains
  `IntersectionObserver`, `prefers-reduced-motion`, `data-motion-ready`, and
  an observer-unavailable fallback that reveals content. This follows the
  repository’s existing source-contract test style and protects the critical
  progressive-enhancement behavior without adding a DOM test dependency.

- [ ] **Step 2: Run the new test before implementation**

  Run:

  ```powershell
  npm.cmd test -- app/landing-motion.test.js
  ```

  Expected: FAIL because `app/landing-motion.jsx` does not exist yet.

- [ ] **Step 3: Implement the minimal client motion helper**

  Implement `LandingMotion` with `useEffect`. Find the landing root, set the
  motion-ready attribute, check `window.matchMedia('(prefers-reduced-motion: reduce)')`,
  reveal all items immediately when reduced motion is enabled, and reveal all
  items immediately when `IntersectionObserver` is unavailable. Otherwise,
  observe each item with a modest threshold and unobserve it after reveal.
  Disconnect the observer on cleanup.

- [ ] **Step 4: Run the motion test to verify it passes**

  Run the same command again. Expected: one test passes with no failures.

---

### Task 3: Replace landing card styling with kinetic editorial styling

**Files:**
- Modify: `app/katedra-scoped.css`

**Interfaces:**
- Removes the previous landing-specific hero-card, trust-card, and Pass-card
  visual treatment.
- Produces open paper-surface layout, a drawn blue rule, timeline motion, price
  rows, focus-visible states, and mobile/reduced-motion behavior.

- [ ] **Step 1: Remove the previous landing-only card-first CSS block**

  Remove the block beginning with `LANDING EDITORIAL POLISH` so its hero
  background, rounded container, trust card, and Pass-card shadow rules cannot
  compete with the new design.

- [ ] **Step 2: Add the open hero and animated rule**

  Style `.landing-hero` as an open surface with no background card, no large
  rounded border, and no shadow. Add a narrow `.landing-hero-rule` or pseudo
  element and animate its scale from `0` to `1` once on load. Style the kicker,
  headline, copy, and text actions with editorial spacing.

- [ ] **Step 3: Add staggered hero motion and action states**

  Use CSS custom properties for stagger delays on the kicker, headline, copy,
  and actions. Animate only opacity and transform. Give the primary action a
  blue underline/arrow shift on hover and focus; keep the secondary action
  quiet and text-based.

- [ ] **Step 4: Add the process timeline**

  Create the blue visual spine with pseudo-elements. Use open-circle markers
  and reveal `[data-reveal]` items only when `.landing-page[data-motion-ready="true"]`
  is present. Keep the default state visible when motion setup does not run.

- [ ] **Step 5: Add the typographic Pass list**

  Style `.landing-price-row` as a full-width linked row with separators, a
  three-column desktop layout for name/description, price, and arrow, and a
  single-column mobile layout. Hover/focus changes tint and shifts only the
  arrow; do not add a badge or card shadow.

- [ ] **Step 6: Add responsive and reduced-motion rules**

  Convert the timeline spine to vertical at `max-width: 700px`, stack actions
  at `max-width: 560px`, keep price rows full-width, and disable all keyframes
  and transitions under `prefers-reduced-motion: reduce`.

- [ ] **Step 7: Run lint after the CSS pass**

  Run:

  ```powershell
  npm.cmd run lint
  ```

  Expected: exit code `0`.

---

### Task 4: Verify the complete Kinetic Editorial demo

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

  Expected: all commands exit `0` and the suite includes the new motion test.

- [ ] **Step 2: Smoke-test all landing destinations**

  With the existing dev server running:

  ```powershell
  $paths='/', '/pisi', '/pisi?screen=scan', '/pisi?tip=s', '/pisi?tip=z', '/pisi?tip=d'
  foreach($path in $paths){
    $code=& curl.exe -s -o NUL -w '%{http_code}' ('http://localhost:3000' + $path)
    "$path=$code"
  }
  ```

  Expected: every path returns `200`.

- [ ] **Step 3: Verify scope safety**

  Confirm only landing UI files plus the new motion test/helper changed. Do not
  modify `.env.local`, `/pisi`, auth, checkout, webhook, account, or dependency
  files. Git is unavailable, so record the explicit file list in the handoff.
