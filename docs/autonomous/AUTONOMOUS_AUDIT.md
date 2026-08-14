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
## Cycle: 2026-08-14e

### Root cause selected

Priority: P1 (entitlement presentation consistency).

`GET /api/account` listed every Stripe entitlement for the user, while the
server access checks recognize only the Katedra Pass catalog (plus its
explicit legacy compatibility shape). The account screen could therefore
show a non-Katedra Stripe entitlement as an active Katedra Pass.

### Fix

- Reused `katedraPassProductFilter()` in the account entitlement query.
- Added a runtime regression test that asserts all three Katedra Pass product
  IDs are present in the query filter.

### Verification

- Account route runtime tests: PASS (3 tests).

### Remaining issues

- The authenticated account and entitlement behavior still needs real staging
  Supabase data for the full G2-G6 proof.
## Cycle: 2026-08-14f

### Root cause selected

Priority: P1 (expired entitlement presentation).

The account API exposed database `status: "active"` without applying the
same expiry check used by server capability authorization. An entitlement
past `purchase_expires_at` could therefore be counted as an active Pass in
the account UI.

### Fix

- Normalize active account entitlements to `expired` when their expiry is not
  in the future, including a missing/invalid expiry.
- Preserve non-active historical statuses for account history.
- Added a runtime regression test for an expired active entitlement.

### Verification

- Account route runtime tests: PASS (4 tests).

### Remaining issues

- Full entitlement proof still requires authenticated staging data and a real
  webhook/refresh journey.

## Cycle: 2026-08-14g

### Root cause selected

Priority: P0 (entitlement fail-open on storage errors).

The shared Project Pass repository returned only `false` when the entitlement
query failed. Chat, balance, and server capability authorization could then
interpret an unavailable entitlement store as an ordinary free/no-Pass state.
That could incorrectly enter starter-wallet logic instead of stopping safely.

### Fix

- Added tri-state `lookupActiveProjectPass` and product-specific lookup helpers.
- Kept boolean wrappers for legacy pure callers, but made server routes use the
  strict result.
- `/api/chat` and `/api/balance` now return `503` and release any reservation
  when Pass state cannot be checked.
- `resolveProjectCapability` now returns `capability_unavailable` when the
  entitlement lookup fails.
- Added route, repository, and capability regression tests.

### Verification

- Focused entitlement/chat/balance/capability tests: PASS (30 tests).
- Full test suite: PASS (123 files, 390 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS.
- Local HTTP `/pisi` smoke: PASS (`200`).

### Remaining issues

- Authenticated staging is still required to prove real entitlement failure,
  webhook, checkout, and Lekta-backed journeys; see `BLOCKERS.md`.

## Cycle: 2026-08-14h

### Audit result

The current local audit found no new code-fixable P0, P1, or P2 issue after
cycle `2026-08-14g`. The remaining incomplete Golden Journey evidence is now
explicitly classified as `BLOCKED_EXTERNAL` where it requires authenticated
Supabase/Stripe/AI or canonical Lekta staging state, rather than being counted
as a partial local pass.

### Evidence

- `G0`, `G1`, and `G8` remain locally evidenced.
- `G2`, `G3`, `G4`, `G5`, `G6`, `G7`, `G9`, and `G10` require external staging
  state documented in `BLOCKERS.md`.
- Local regression suite, typecheck, lint, build, and the `/pisi` HTTP smoke
  remain green from the preceding verified cycle.

### Remaining issues

- Do not enable agentic/project-lock/material feature flags until the Lekta
  contract, worker, RLS, cleanup, and authenticated staging journeys pass.
- Do not declare V1 Product Complete until the required external journeys are
  executed and the double-full-pass audit is completed.
