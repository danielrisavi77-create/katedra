# Implementation Plan: Academic Context Compiler

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task with review checkpoints.

**Goal:** Uvesti jedan centralni, deterministički `AcademicContext` koji stvarno prenosi verificirana pravila iz `public/katedra-pack.json` kroz onboarding, Completion Scan, outline, Project Home, Pravila, AI promptove, agenticni worker, Pass capability i Lekta handoff.

**Architecture:** `public/katedra-pack.json` ostaje read-only artifact koji generira Lekta. `lib/academic-context/` dobiva čisti parser/compiler sloj bez React i Supabase ovisnosti. Browser i server koriste isti validirani model: browser dobiva pack preko fetcha, server ga učitava iz `public/`. Rukopis i dalje sprema samo `unitId`/`profileId` i korisničke metapodatke; cijeli pack se nikada ne sprema u `/api/state` niti u rukopis.

**Tech Stack:** TypeScript, Next.js 16, React 19, Vitest/Vitest browser tests, postojeći Supabase/agent capability sloj.

## Global constraints

- `verified` profil može koristiti puni fakultetski coaching i relevantni Pass claim.
- `partial` je vidljiv i jasno označen, ali dobiva samo generički/free coaching bez tvrdnje da su pravila potvrđena.
- `research` i `generic` ostaju u općem free načinu rada bez fakultetskih obećanja.
- Nepoznati profil, nekompatibilan `workType` i malformed pack moraju fail-closed bez rušenja onboarding UI-ja.
- Svaki prikaz akademskog pravila mora prikazati status, a za verified/partial profil i `verifiedAt` te službeni izvor kada postoji.
- Klijent ne može sam proglasiti profil verified niti otključati capability.
- Ne uvodi se nova shared database migracija; Lekta ostaje authority za shared schema/RPC.
- Ne kopira se cijeli pack u `ManuscriptV1`, `/api/state`, AI prompt ili agent payload. Svi konteksti su bounded i uključuju samo odabrani profil.
- Ne dirati nepovezane postojeće promjene u dirty worktreeju.

## Task 1 — Raw academic pack model and loader

**Files:**

- Create `lib/academic-context/types.ts`
- Create `lib/academic-context/load-pack.ts`
- Modify `lib/manuscript/academic-catalog.ts`
- Create `lib/academic-context/load-pack.test.ts`
- Extend `lib/manuscript/academic-catalog.test.ts` only where compatibility is required

### TDD steps

1. Add failing tests proving the loader preserves the rich FPZG diplomski profile fields: status, verifiedAt, word range, minReferences, font/size/spacing, sections, manualChecks, facts, submissionFacts and source `{title,url}` values.
2. Add failing tests proving malformed units/profiles/sources are discarded, valid profiles remain, and missing top-level arrays produce an empty catalog rather than a throw.
3. Add failing tests proving legacy `createAcademicCatalog`, unit search, profile search and work-type filtering continue to work.
4. Implement bounded raw types and `createAcademicCatalog`/`createAcademicPack` parsing while retaining the existing selector API.
5. Add server-safe `loadAcademicPack()` from `public/katedra-pack.json` and a pure `loadAcademicPackFromValue()` path so browser tests never depend on filesystem access.
6. Run the new focused loader/catalog tests and verify the red-to-green transition.

### Acceptance

- The catalog retains rich profile rules without exposing unknown raw pack fields.
- FPZG diplomski can be found by `fpzg`, `Politologija`, acronym and compatible `d`/`graduate` work type.
- Existing onboarding selector behavior remains compatible.

## Task 2 — Context compiler, profile resolution, visibility and freshness

**Files:**

- Create `lib/academic-context/resolve-profile.ts`
- Create `lib/academic-context/compile-context.ts`
- Create `lib/academic-context/visibility.ts`
- Create `lib/academic-context/freshness.ts`
- Create `lib/academic-context/compiler.test.ts`
- Create `lib/academic-context/visibility.test.ts`

### TDD steps

1. Add failing FPZG acceptance tests for `fpzg-politologija-diplomski`: `10000..12000` words, `15` minimum references, `3` books parsed only from explicit facts/checks, FPZG citation label, required sections and official URLs.
2. Add a failing differentiation test proving `fpzg-politologija-diplomski` differs from `fpzg-politologija-zavrsni` in word range, source guidance and compiled checks.
3. Add failing tests for valid/invalid profile resolution: unit/profile mismatch, incompatible work type, unknown IDs, empty IDs and generic free-text fallback.
4. Add failing tests for status policy: verified/full and paid enabled; partial/research/generic generic/coaching mode and paid/autonomous/web-research disabled according to the compiled policy.
5. Add failing tests for date validation and advisory freshness: invalid/missing date never proves verified; old valid date reports stale advisory without silently downgrading status.
6. Implement the compiler with explicit citation registry, bounded arrays/text, explicit minimum-books extraction and deterministic fallback.
7. Run focused compiler/visibility tests and then the existing academic catalog tests.

### Acceptance

- One `AcademicContext` is the only compiled representation consumed by downstream code.
- `minimumBooks` is undefined unless an explicit fact/manual check names a number.
- `generic` context has no faculty claim and no paid capability.

## Task 3 — Onboarding, manifest and Completion Scan integration

**Files:**

- Modify `app/pisi/components/onboarding-flow.tsx`
- Modify `app/pisi/components/workspace-client.tsx`
- Modify `lib/project/completion-scan.ts`
- Modify `lib/manuscript/migration.ts` only for context input compatibility
- Create/extend `lib/project/completion-scan.test.ts`
- Extend onboarding/workspace component tests

### TDD steps

1. Add failing tests showing Completion Scan output changes when the selected context changes from FPZG završni to FPZG diplomski: status, word target, minimum sources and next actions.
2. Add failing tests proving the scan exposes partial/generic limitations and does not claim verified faculty rules.
3. Add failing tests proving onboarding compiles the selected profile but persists only `unitId`, `profileId` and existing compact metadata; no `academicContext`, pack or extracted manuscript text is put into the manifest sync payload.
4. Implement `CompletionScanInput.academicContext` and context-aware strengths/missing/next actions, including required sections and manual checks.
5. Load and compile the profile in onboarding after unit/profile selection and pass the context into scan/project state without expanding the persisted schema.
6. Preserve `?tip=s|z|d`, `?screen=scan`, existing project migration and guest local-only behavior.
7. Run focused project/onboarding tests and reload a guest project locally to verify the same project ID and context selection survive.

### Acceptance

- A guest selecting FPZG diplomski sees a scan that mentions its 10,000–12,000 word target, minimum 15 sources/3 books when applicable, required sections and official-rule status.
- Generic/free-text selection produces useful generic guidance but never a verified-faculty claim.
- Full manuscript text still never enters `/api/state`.

## Task 4 — Outline, AI prompt and agent payload integration

**Files:**

- Modify `lib/manuscript/context.ts`
- Modify `lib/manuscript/model.ts` or outline helper used by onboarding, only if needed to build required sections
- Modify `app/pisi/components/workspace-client.tsx`
- Modify `lib/agents/worker.ts`
- Modify `lib/agents/provider-worker.ts` or the canonical payload builder location
- Modify `lib/agents/run-context.ts` only if a typed context field is required
- Create/extend `lib/manuscript/context.test.ts`
- Create/extend agent payload tests

### TDD steps

1. Add failing prompt tests asserting the bounded academic block includes profile status, verified date, word/page target, minimum references/books, citation style, required sections, manual checks and official sources.
2. Add failing tests asserting the prompt does not include the full pack, unknown raw fields or unbounded submission facts.
3. Add failing tests proving the FPZG diplomski and završni prompts differ in academic rules and capability guidance.
4. Add failing agent payload tests proving worker context receives the same serialized bounded academic context and that generic/partial policy cannot be overridden by a client field.
5. Add failing outline tests proving a new outline can use `requiredSections`, while an existing user-approved outline is preserved unless explicitly regenerated.
6. Implement a shared serializer used by Completion Scan, prompt and agent payload; inject the server-compiled context in worker paths using canonical `unitId`/`profileId` resolution.
7. Keep AI policy/capability enforcement server-side and preserve source-gate language: unverified claims cannot be treated as evidence.
8. Run focused prompt, outline and agent tests plus existing chat/agent tests.

### Acceptance

- The selected FPZG profile materially changes prompt instructions, outline sections and agent payload.
- The browser cannot send a fake verified context to gain capability.
- Generic/partial contexts cause coaching/generic behavior rather than faculty-specific claims.

## Task 5 — Project Home, Pravila, Pass availability, export and Lekta handoff

**Files:**

- Modify `app/pisi/components/project-home.tsx`
- Modify `app/pisi/components/project-drawer.tsx`
- Modify `app/pisi/components/pass-dialog.tsx`
- Modify `lib/product/server-capabilities.ts` and/or the canonical capability helper
- Modify `lib/manuscript/export-docx.ts` or its export model
- Modify `lib/academic-suite/handoff.ts` only for context/status metadata required by the handoff contract
- Create/extend component, capability and export tests

### TDD steps

1. Add failing component tests for Project Home and Pravila showing status badge, verified date, word/page target, references/books, citation style, required sections, manual checks and official source links.
2. Add failing tests proving editable fields are limited to user metadata (mentor, deadline, notes); verified academic rules are displayed read-only.
3. Add failing capability tests proving only verified canonical profiles can make a faculty Pass claim; partial/research/generic profiles remain generic/free even if a client sends a `profileId`.
4. Add failing export/handoff tests proving the selected context contributes a transparent warning and profile/source metadata without claiming DOCX certification.
5. Implement the UI/context integration and server-side verified gate without changing the existing Stripe product IDs or adding database migrations.
6. Run focused component/capability/export tests and manually inspect `/pisi` in light/dark mode at desktop and mobile widths.

### Acceptance

- Rules shown in the UI always expose source/date/status.
- FPZG diplomski changes Project Home, Rules, Pass availability and export warning compared with FPZG završni.
- A partial profile cannot be sold as fully verified.

## Task 6 — End-to-end regression and quality gates

**Files:**

- Extend existing onboarding/workspace/browser E2E coverage
- Create `scripts/academic-context-e2e.mjs` if the existing browser harness cannot express the scenario
- Update `docs/architecture/PRODUCT_LIFECYCLE.md` with the compiler contract and fallback behavior

### Tests

1. Run the FPZG scenario: select diplomski → Completion Scan → outline → Project Home/Pravila → AI prompt context → agent payload fixture → Pass capability → export/handoff metadata.
2. Run the comparison scenario for FPZG završni and assert the expected differences.
3. Run partial and generic scenarios and assert no verified faculty promise or paid capability.
4. Run malformed-pack and unknown-profile scenarios and assert safe generic fallback/no onboarding crash.
5. Run light/dark and mobile layout smoke checks with no horizontal overflow.
6. Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

7. Start local dev server if it is not already running and inspect `http://localhost:3000/pisi` with the FPZG scenario. Record any environment-only limitation separately; do not weaken tests to accommodate it.

### Final acceptance

- FPZG diplomski profile selection changes Completion Scan, outline, word target, minimum references/books, citation style, AI capabilities and official sources.
- All existing quality gates pass, or a concrete pre-existing/unrelated failure is documented with command output.
- No existing landing/auth/legal/checkout behavior is changed unintentionally.

## Checkpoints and review protocol

- Each task begins with a failing focused test and ends with focused tests plus the relevant existing suite.
- After each task, review the diff for scope, privacy and server/client trust boundaries before moving on.
- Keep the shared worktree’s unrelated edits and do not commit/push unless explicitly requested later.
- Use the local host for every UI checkpoint; do not claim UI completion from source inspection alone.
