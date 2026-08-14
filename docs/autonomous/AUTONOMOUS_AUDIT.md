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

## Cycle: 2026-08-14i

### Independent final audit result

Without changing production code after cycle `2026-08-14h`, the available
local validation was rerun from the current working tree:

- `npm.cmd test`: PASS (123 files, 391 passed, 4 skipped).
- `npm.cmd run test:ci`: PASS (123 files, 391 passed, 4 skipped).
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run lint`: PASS.
- `npm.cmd run build`: PASS.
- HTTP smoke for `/`, `/pisi`, `/racun`, `/prijava`, `/privatnost`, and
  `/uvjeti`: all `200`.
- Authenticated money-flow E2E: not started because
  `KATEDRA_INTEGRATION_URL` is unavailable.
- Agentic staging preflight: expected fail-closed exit `1` because the worker,
  model, project-lock and agent-run staging variables are unavailable.

This second audit found no new local code-fixable P0, P1, or P2 issue. V1 is
not declared complete while the external staging journeys remain unexecuted;
the exact blockers and owner actions remain in `BLOCKERS.md`.

## Cycle: 2026-08-14j

### Root cause selected

Priority: P1 (agentic entitlement lifecycle).

`POST /api/agent-runs/:runId/context` checked that a project had a historical
lock, but did not re-check that its Project Pass was still active. A run could
therefore accept and store a new manuscript context after expiry or
revocation.

### Fix

- Reused the strict `lookupActiveProjectPass` repository in the context route.
- Return `402` for an inactive Pass and `503` when entitlement state cannot be
  verified.
- Reject the request before storing or attaching any new payload.
- Added runtime regressions for both inactive and unavailable Pass state.

### Verification

- Focused agent context/contract/entitlement tests: PASS (24 tests).
- Full suite: PASS (128 files, 393 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS.
- Local HTTP smoke: `/`, `/pisi`, `/racun`, `/prijava`, `/privatnost`, and
  `/uvjeti` all returned `200`.

### Remaining issues

- Agent runs remain disabled until the canonical Lekta contract and staging
  worker are deployed and verified; see `BLOCKERS.md`.

## Cycle: 2026-08-14k

### Root cause selected

Priority: P1 (project-specific Pass enforcement on agent context).

After the previous expiry check, the context route still accepted any active
Katedra Pass. A Seminarski entitlement could therefore authorize a context
update for a project locked as Završni if the canonical run RPC or another
layer did not reject it first.

### Fix

- Normalize and validate the locked product key against the locked work type.
- Use `lookupActiveProjectPassForProduct` with the exact catalog product ID.
- Reject mismatched or malformed lock metadata fail-closed before storing the
  manuscript context.
- Added a regression proving an active wrong-tier Pass cannot authorize the
  run.

### Verification

- Focused context route tests: PASS (3 tests).
- Full suite: PASS (128 files, 394 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS.
- Local HTTP smoke: all six primary routes returned `200`.

### Remaining issues

- Canonical Lekta RPC/RLS and authenticated staging still need to verify the
  same project/tier invariant across the real worker and database boundary.

## Cycle: 2026-08-14l

### Root cause selected

Priority: P1 (resuming an agentic run after entitlement expiry).

The resume route authenticated only the user and delegated directly to the
resume RPC. It did not re-read the run's project lock or active product Pass,
so a paused run could potentially resume after the Pass expired or changed.

### Fix

- Load the run through the authenticated user's project scope.
- Require a valid lock and matching work-type/product tier.
- Re-check the exact `katedra_pass_*` entitlement before calling
  `resume_agent_run`.
- Return `402` for inactive access and `503` for unavailable or malformed
  authorization state.
- Added a runtime regression proving an expired Pass cannot resume a run.

### Verification

- Full suite: PASS (129 files, 395 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Local HTTP smoke: all six primary routes returned `200`.

### Remaining issues

- Real resume/worker behavior still requires the canonical Lekta RPC/RLS and
  authenticated staging environment described in `BLOCKERS.md`.

## Cycle: 2026-08-14m

### Root cause selected

Priority: P1 (transient provider failures were not retried safely).

The provider-to-worker bridge treated HTTP 429/5xx, network failures and
incomplete provider streams as ordinary failures. The worker therefore ended
the step immediately instead of using the existing maximum-three-attempt
contract. In addition, a non-retryable billing or configuration failure could
be reported to the scheduler as `retrying` even though the backend step was
not requeued.

### Fix

- Add an explicit retryable signal to provider error events.
- Mark provider 429/5xx, network, malformed-stream and incomplete-result
  failures as retryable while keeping validation, capability and billing or
  configuration errors non-retryable.
- Convert retryable provider errors into verifier `needs_revision` results so
  the worker requeues only while the attempt is below three; the third attempt
  becomes blocked.
- Align the worker return status with the persisted backend status so a failed
  non-retryable step is never reported as retrying.
- Add regression coverage for provider signals, HTTP status retryability,
  bounded worker retries and non-retryable billing/configuration failures.

### Verification

- Focused provider/worker tests: PASS (3 files, 17 tests).
- Full suite: PASS (129 files, 399 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).

### Remaining issues

- Local HTTP smoke: PASS via `curl` against the existing localhost process;
  `/`, `/pisi`, `/racun`, `/prijava`, `/privatnost`, and `/uvjeti` all returned
  `200`. No process was terminated.
- Real retry, billing reconciliation and worker lease behavior still require
  the canonical Lekta RPC/RLS and authenticated staging environment described
  in `BLOCKERS.md`.

## Cycle: 2026-08-14n

### Root cause selected

Priority: P1 (agent billing ambiguity was not persisted as a reconciliation
state).

The canonical billing contract requires every AI attempt to end as
`settled`, `released` or `pending_reconciliation`. When the agent worker
received an unknown `katedra_consume` response, an RPC error, or an unusable
billing outcome, it only propagated a generic exception. The step was then
completed without an explicit billing state, making it impossible to
distinguish a safe release from a charge that needs reconciliation.

### Fix

- Add an explicit `AgentBillingReconciliationError` carrying the billing
  state.
- Mark reservation/usage failures as `released` and unknown, failed or
  ambiguous consume results as `pending_reconciliation`.
- Persist the billing state in the worker verification and private result
  payload, and complete the step without blindly reissuing the same debit.
- Preserve the existing idempotent `settled`/`already_settled` path.
- Add regressions for ambiguous consume responses and worker reconciliation
  handling.

### Verification

- Focused billing/worker/storage tests: PASS (3 files, 14 tests).
- Full suite: PASS (129 files, 401 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Local HTTP smoke: PASS via `curl`; `/`, `/pisi`, `/racun`, `/prijava`,
  `/privatnost`, and `/uvjeti` all returned `200`.

### Remaining issues

- The real billing reconciliation result and idempotency behavior still need
  canonical Lekta RPC/RLS and authenticated staging verification described in
  `BLOCKERS.md`.

## Cycle: 2026-08-14o

### Root cause selected

Priority: P1 (agent worker could run with incomplete safety configuration).

The internal agent worker checked its feature flag, worker token and Anthropic
key, but still supplied a fallback model and did not require the canonical
billing v2 contract or distributed Supabase rate-limit store. Enabling only
the agent flag could therefore reach provider execution without the same
fail-closed guarantees as `/api/chat`.

### Fix

- Add a pure worker configuration gate requiring
  `KATEDRA_AGENT_MODEL`, `KATEDRA_BILLING_RPC_CONTRACT=v2` and
  `KATEDRA_RATE_LIMIT_STORE=supabase`.
- Return `503` before loading a run or calling the provider when any contract
  is missing or invalid.
- Remove the fallback model and use only the configured server-side model.
- Add configuration and route-contract regressions for missing and legacy
  safety settings.

### Verification

- Focused worker configuration/route tests: PASS (2 files, 6 tests).
- Full suite: PASS (126 files, 405 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Local HTTP smoke: PASS via `curl`; `/`, `/pisi`, `/racun`, `/prijava`,
  `/privatnost`, and `/uvjeti` all returned `200`.

### Remaining issues

- The required model, billing and rate-limit values still need canonical
  staging deployment and evidence before agent flags can be enabled; see
  `BLOCKERS.md`.

## Cycle: 2026-08-14p

### Root cause selected

Priority: P1 (material upload abuse and request-size handling).

The materials endpoint validated the extracted buffer only after parsing the
whole multipart request, had no per-user/concurrency reservation, and did not
fail closed in production when the distributed rate-limit store was absent.
That left the temporary upload path weaker than the chat and DOCX paths before
the materials feature flag could safely be enabled.

### Fix

- Reject oversized requests using the content-length budget before multipart
  parsing, and reject oversized files before reading them into memory.
- Apply the existing atomic Supabase reservation in production and a bounded
  local limiter only for development.
- Return controlled `429`/`503` responses for rate and configuration failures.
- Release the reservation in a `finally` block and log release failures with a
  request ID.
- Preserve project ownership, Pass capability and private temporary-storage
  checks.
- Update the prelaunch ledger to mark the already-completed landing migration
  instead of retaining stale onboarding-only documentation.

### Verification

- Focused material route test: PASS.
- Full suite: PASS (126 files, 405 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Local HTTP smoke: PASS via `curl`; `/`, `/pisi`, `/racun`, `/prijava`,
  `/privatnost`, and `/uvjeti` all returned `200`.

### Remaining issues

- Real atomic material reservation and private bucket/RLS behavior still need
  canonical Lekta staging verification before `KATEDRA_MATERIALS_ENABLED` is
  enabled; see `BLOCKERS.md`.

## Cycle: 2026-08-14q

### Root cause selected

Priority: P2 (duplicate Tiptap link extension in the manuscript editor).

The running local browser logged repeated `Duplicate extension names found:
['link']` warnings. `StarterKit` registered its built-in link extension while
the editor also registered the separately configured safe-link extension.
That could make link commands and schema behavior ambiguous.

### Fix

- Disable `StarterKit`'s built-in link extension.
- Keep the explicit link extension as the single owner of safe URL validation
  and link toolbar behavior.
- Strengthen the editor regression so it verifies the option is configured on
  `StarterKit`, not merely that an unrelated `linkOnPaste: false` string exists.

### Verification

- Focused editor test: PASS.
- Playwright `/pisi` browser smoke: PASS; duplicate link warnings `0`.
- Full suite: PASS (126 files, 405 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Local HTTP smoke: PASS via `curl`; `/`, `/pisi`, `/racun`, `/prijava`,
  `/privatnost`, and `/uvjeti` all returned `200`.

### Remaining issues

- Dependency audit could not reach the npm advisory endpoint in this
  environment; rerun it in a network-enabled release environment.
- Authenticated commerce, canonical Lekta contracts and staging browser
  journeys remain the external blockers listed in `BLOCKERS.md`.

## Cycle: 2026-08-14s

### Root cause selected

Priority: P2 (misleading state-sync error for canonical project ownership
conflicts).

When the compatibility write path reached the canonical Academic Suite trigger
with a project identity already owned by another account, the database returned
the expected unique/ownership conflict (`23505`), but `/api/state` collapsed it
into a generic `500`. The client could not distinguish a project conflict from
a temporary server failure and had no safe recovery message.

### Fix

- Map only the canonical unique/ownership conflict code to `409`.
- Return a generic Croatian conflict message without exposing database details.
- Keep all other persistence failures as `500`.
- Add a runtime regression test for the conflict response.

### Verification

- TDD regression: PASS (red before the route change, green after it).
- Focused state tests: PASS (7 tests).
- Full Katedra suite: PASS (126 files, 406 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Playwright smoke: PASS; desktop/mobile `/pisi` and mobile `/racun` had no
  horizontal overflow, page errors, scroll warnings or duplicate-link warnings.
- Lekta agentic contract tests: PASS (4 files, 11 tests). Full Lekta `npm run
  check` remains non-green because of pre-existing unrelated title-page test
  parsing and generated real-corpus markdown drift; no Lekta files were changed
  in this cycle.

### Remaining issues

- Dependency audit could not reach the npm advisory endpoint in this
  environment; rerun it in a network-enabled release environment.
- Authenticated commerce, canonical Lekta deployment and staging browser
  journeys remain the external blockers listed in `BLOCKERS.md`.
- Lekta's unrelated full-gate failures remain open and must be resolved in the
  Lekta repository before the cross-repo release gate can be called green.

## Cycle: 2026-08-14r

### Root cause selected

Priority: P2 (Next.js route-transition warning caused by global smooth scrolling).

The global stylesheet intentionally enables smooth scrolling, but the root
`html` element did not declare that behavior for Next.js. The local browser
therefore logged a route-transition warning on page navigation.

### Fix

- Declare `data-scroll-behavior="smooth"` on the root `html` element.
- Add a source-level regression assertion so the declaration cannot disappear
  while the global scroll-to-top behavior remains enabled.

### Verification

- TDD regression: PASS (red before the layout change, green after it).
- Full suite: PASS (126 files, 405 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Playwright local browser smoke: PASS; `/`, `/pisi`, `/racun`, `/prijava`,
  `/privatnost`, and `/uvjeti` all returned `200` with zero scroll warnings.

### Remaining issues

- Dependency audit could not reach the npm advisory endpoint in this
  environment; rerun it in a network-enabled release environment.
- Authenticated commerce, canonical Lekta contracts and staging browser
  journeys remain the external blockers listed in `BLOCKERS.md`.
