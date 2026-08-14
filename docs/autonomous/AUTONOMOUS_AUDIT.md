# Autonomous product-completion audit

## Cycle: 2026-08-14

### Root cause selected

Priority: P1 (project continuity / G1 and G8).

After a guest wrote a manuscript and reloaded `/pisi`, bootstrap always set the
workspace to the project home. The local IndexedDB manuscript was present, but
the user was not returned to the active writing surface. This contradicted the
product promise that Katedra knows where the student stopped.

### Fix

- Persist a small per-project workspace preference (`home`, `writing`, `agents`).
- Restore it after validated manuscript bootstrap.
- Keep onboarding authoritative: incomplete projects always start in onboarding.
- Extend the browser acceptance flow to assert the same project ID and writing
  view after reload.

### Verification

- `lib/manuscript/workspace-view.test.ts`: PASS
- Playwright guest reload flow: PASS; project identity preserved, editor restored,
  `data-workspace-view="writing"`, no horizontal overflow, no page errors.
- Full regression gates are recorded in the handoff report for this cycle.

### Remaining issues

- Authenticated registration, Stripe, canonical Lekta RPC deployment and full
  agentic staging remain external blockers; see `BLOCKERS.md` and
  `GOLDEN_JOURNEYS.md`.
- Do not enable agentic feature flags until the canonical preflight passes.

## Cycle: 2026-08-14b

### Root cause selected

Priority: P0 (commerce / project entitlement safety).

The production preflight only required project locks when agentic runs were
enabled. A deployment could therefore pass the preflight, accept a paid Pass,
and grant entitlement without server-side topic/project locking.

### Fix

- Production preflight now requires `KATEDRA_PROJECT_LOCKS_ENABLED=true` for
  every paid production deployment.
- `/api/checkout` refuses to create a Stripe session when production locks are
  unavailable.
- `/api/webhook` refuses to grant a paid entitlement when production locks are
  unavailable.
- Added runtime tests for both fail-closed paths and the preflight invariant.

### Verification

- checkout/webhook/preflight focused tests: PASS (13 tests)
- `npm run test:ci`: PASS (121 files, 379 passed, 4 skipped)
- typecheck: PASS
- lint: PASS
- build: PASS
- production preflight without deployment secrets: FAIL closed, including
  `KATEDRA_PROJECT_LOCKS_ENABLED` in the missing variables.

## Cycle: 2026-08-14c

### Root cause selected

Priority: P1 (capability authorization / paid chat bypass).

When the project-lock gate was enabled, `/api/chat` only resolved a server
capability when the client-supplied capability happened to map to a known paid
action. Empty or unknown values fell through to the legacy chat path. The
editor also sent an empty value for review/coaching actions, so the contract
was implicit rather than explicit.

### Fix

- Added the explicit `contextual_ai` capability to the product matrix,
  including the bounded Free contextual intervention.
- Every manuscript editor action now declares either
  `generate_large_sections` or `contextual_ai`.
- With project locks enabled, `/api/chat` rejects missing or unknown capability
  values before wallet, rate-limit or provider access.
- Documented the capability contract and preserved the legacy fallback only
  while project locks are disabled for local development.

### Verification

- Chat runtime regression tests: PASS; missing and unknown capabilities return
  `400` before the capability/provider path.
- Capability and manuscript-context tests: PASS.
- `npm.cmd run test:ci`: PASS (121 files, 382 passed, 4 skipped).
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run lint`: PASS.
- `npm.cmd run build`: PASS.
- Local Playwright `/pisi` smoke: PASS; no page errors.

### Remaining issues

- Authenticated staging still remains required to prove the full paid and
  Lekta journeys; see `BLOCKERS.md`.

## Cycle: 2026-08-14d

### Root cause selected

Priority: P1 (project continuity / account project selection).

The account center linked to `/pisi?projectId=...`, but the workspace bootstrap
always selected the global `rp_manifest`. Opening another account project could
therefore display the wrong local manuscript.

### Fix

- Added a tested workspace-project selector.
- An explicit `projectId` now wins over the current global manifest.
- Legacy `rp_state` is not reused when opening a different project, preventing
  one project's metadata from being applied to another.
- The active project's local metadata remains intact when the requested ID is
  the same project.

### Verification

- Workspace project selector tests: PASS (3 tests).
- Workspace observability regression tests: PASS (3 tests).
- Full regression and browser validation will be recorded after this cycle's
  final gates.

### Remaining issues

- The account center can list server projects, but a manuscript that has never
  been stored on the current device still requires onboarding before local
  writing can continue; cross-device manuscript sync remains intentionally out
  of V1 scope.
