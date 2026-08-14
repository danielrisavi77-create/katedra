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
