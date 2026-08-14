# Katedra product lifecycle i `/pisi` mentor workspace — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task with review checkpoints.

**Goal:** Pretvoriti Katedru iz skupa AI funkcija u vođeni projektni sustav koji korisniku prikazuje stanje projekta, sljedeći korak, dostupne capabilityje i put od teme do predaje.

**Architecture:** Next.js ostaje UI/API sloj. Lekta ostaje canonical authority za entitlement, project lock, agent runs i DOCX/compliance. Rukopis ostaje lokalna canonical kopija; server sprema samo metapodatke i ugovorno dopuštene run podatke.

## Global Constraints

- Pass vrijedi samo za jedan `projectId`.
- Tema, vrsta rada i plaćeni opseg zaključavaju se nakon uspješne naplate.
- Korisnik ne bira AI providera.
- Svaki agent ima zasebnog verifikatora i najviše tri pokušaja popravka.
- AI ne smije tiho prepisati rukopis.
- Autonomni način i dalje prolazi source gate, verifier i quality gate.
- Puni rukopis se ne šalje u `/api/state` niti u shared backend.
- Database migracije i RPC-i rade se samo u Lekta repozitoriju.
- Agenticni feature flagovi ostaju isključeni dok Lekta ugovori i staging testovi ne prođu.

### Task 1: Product lifecycle and capability matrix

Define `ProductTier`, `ProjectStage` and `ProjectCapability` in `lib/product/lifecycle.ts` and `lib/product/capabilities.ts`. Add a server-side `resolveProjectCapability()` that validates authenticated user, project ownership, active project Pass, locked work type, product id and expiry. Define free, seminarski, zavrsni and diplomski capability matrices. Extend the Pass catalog without changing existing product ids. Add unit tests for every capability, expiry, cross-project access, client workType tampering and missing verified policy.

### Task 2: Free onboarding and Completion Scan

Extend `app/pisi/components/onboarding-flow.tsx` to five steps: new/existing, work type, faculty/program/rules, current state/deadline/mentor, and available materials. Add local-only `lib/project/completion-scan.ts`, `lib/project/next-action.ts` and `app/pisi/components/free-project-plan.tsx`. Guests receive a local Completion Scan and three next actions; registration attaches the same project id. Do not upload full manuscript text. Cover query compatibility `?tip` and `?screen=scan` with tests.

### Task 3: `/pisi` project home

Add `ProjectHome`, `NextActionCard` and `ProjectTimeline` components. Change `WorkspaceClient` so the default post-onboarding view is the project home, with one primary next action, phase, project metadata, materials, Pass, Lekta and entry points to writing/preparation/agents. Preserve the existing editor, autosave, local versions and agentic views. Update shell/navigation/CSS, mobile layout, dark mode and reduced motion. Add component and browser tests with no horizontal overflow.

### Task 4: Account center

Expand `/racun` into a real account center. Add authenticated account summary, project list, Pass summary, AI usage summary, Lekta status, privacy, export and delete controls. Add `app/api/account/route.js`, `/export` and `/delete` with ownership checks, fresh-session confirmation for deletion and metadata-only export. Preserve withdrawal flow. Add auth, multi-project, ownership, export and duplicate-delete tests.

### Task 5: Contextual paywall and tier depth

Create a shared server/UI capability and paywall-copy layer. Make PassDialog contextual to work type and requested capability. Keep checkout server-side canonical confirmation, project lock and 409 after-paid-topic mutation. Implement product differences by workflow depth rather than visual premium styling or token-only limits. Add tests for correct/incorrect Pass, confirmation, duplicate webhook, locked project and client capability tampering.

### Task 6: Agentic workflow and Lekta activation gate

Integrate capability checks into existing agent run/material routes and panels. In Lekta define canonical lock/run/step/payload/lease/RPC contracts, RLS, idempotency and TTL cleanup. Keep flags false until preflight verifies tables and RPCs. Agent steps must show agent, verifier, attempt, sources, usage, billing outcome, checkpoint and blocked reason. Add staging tests for upload, source gate, three failed retries, pause/resume, worker claim, browser close/resume, provider errors and billing reconciliation.

### Task 7: Export, handoff and release gates

Ensure DOCX export uses the selected local revision and canonical project id, with the required Lekta verification warning. Add authenticated money-flow and agentic workflow browser E2E. Run typecheck, lint, test:ci and build after each task; fix lint scope so generated worktrees/build artifacts are excluded. Verify localhost `/pisi` and `/racun` in desktop/mobile/light/dark/anonymous/authenticated states.

## Acceptance criteria

- Guest receives a useful plan before payment and registration preserves the project.
- `/pisi` always shows the next concrete action.
- A Pass unlocks only its project and product scope.
- Tier differences are visible in workflow capabilities.
- Every agent result is verified and has at most three repair attempts.
- Local manuscript versions protect the user's source text.
- DOCX export hands off the same project id to Lekta.
- Staging money flow and all local quality gates pass.
