# Autonomous product-completion audit

## Cycle: 2026-08-15m

### Root cause selected

Priority: P2 (account data-query failures were rendered as confirmed empty
state).

`/api/account` converted failed project, Pass and usage queries into empty
arrays or a zero-valued usage summary. The account UI then displayed those
values as real facts, which could mislead a returning user during a backend
outage.

### Fix

- Preserve unavailable account collections and usage as `null` while retaining
  explicit warnings.
- Render an em dash and a status message for unavailable metrics instead of
  confirmed zeroes.
- Keep the account page usable and expose the warning without sending the user
  into a false success state.
- Add route and jsdom regressions for unavailable project/Pass/usage data.

### Verification

- TDD regression: PASS; the new route/UI assertions failed before the null
  contract and passed afterward.
- Focused account tests: PASS (8 tests).
- Full Katedra suite: PASS (131 test files passed, 444 tests passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright localhost regression: PASS at 390px and 1440px; anonymous account
  actions stayed hidden and unavailable authenticated account data rendered as
  warnings instead of confirmed zeroes.

### Golden Journey impact

- G9: improved local recovery for account backend/query failures; authenticated
  staging failure recovery remains external.
- G8: returning users no longer receive false project/usage zeros during a
  transient account data failure.

### Commit

- Isolated changeset: `fix: make account data failures explicit`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15l

### Root cause selected

Priority: P2 (anonymous `/racun` exposed account-only actions).

The page rendered account deletion and withdrawal controls even when
`/api/account` returned `401`. Both actions require an authenticated account,
so a guest saw controls that could only end in an API error. This weakened the
account-center mental model and created an avoidable failure path in G9.

### Fix

- Keep privacy guidance visible to guests, but hide account deletion and
  withdrawal actions until the authenticated account payload is available.
- Show one explicit login CTA returning to `/racun`.
- Add a jsdom regression test and a browser assertion for both mobile and
  desktop widths.

### Verification

- TDD regression: PASS; the new DOM test was red before the conditional account
  rendering and green afterward.
- Focused account tests: PASS (4 tests).
- Full Katedra suite: PASS (131 files, 442 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright local smoke: PASS; anonymous `/racun` hides both account-only
  actions, shows the login CTA, has no page exceptions, and has no horizontal
  overflow at 390px or 1440px.

### Golden Journey impact

- G9: improved local anonymous/session-error recovery; authenticated payment
  and provider failure evidence remains external.
- G8: no change to returning authenticated project behavior.

### Commit

- Isolated changeset: `fix: clarify anonymous account actions`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15k

### Root cause selected

Priority: P0 (production checkout/webhook could remain reachable when the
canonical billing RPC contract was unavailable).

The checkout and paid-session webhook already failed closed when project-lock
enforcement was disabled, but they did not apply the same boundary to
`KATEDRA_BILLING_RPC_CONTRACT`. This could allow a payment session to open, or
allow a webhook retry to enter the legacy wallet grant path, during billing
contract drift.

### Fix

- Require `KATEDRA_BILLING_RPC_CONTRACT=v2` before production checkout starts.
- Require the same contract before a production paid-session webhook grants an
  entitlement or wallet balance.
- Add runtime regressions proving Stripe/admin initialization is skipped when
  the billing contract is missing or legacy.

### Verification

- TDD regression: PASS; both new tests failed before the guards and passed
  afterward.
- Focused checkout/webhook tests: PASS (9 tests).
- Full Katedra suite: PASS (130 files, 441 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright local smoke: PASS; `/pisi?tip=d` and `/racun` at 390px and
  1440px had no horizontal overflow or page exceptions. Anonymous `/racun`
  API `401` responses are expected and do not produce page errors.

### Commit

- Isolated changeset: `fix: gate commerce on billing contract`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Production agentic flags remain disabled until canonical preflight and
  authenticated staging evidence pass.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15j

### Root cause selected

Priority: P0 (production `/api/balance` could fall back to legacy billing
behavior when canonical project contracts were disabled).

The balance endpoint influences the paywall and free-starter path. Unlike the
chat, checkout, webhook and state routes, it did not fail closed when
project-lock enforcement or billing RPC v2 was missing, so configuration drift
could make the UI use the legacy global-wallet path.

### Fix

- Require both `KATEDRA_PROJECT_LOCKS_ENABLED=true` and
  `KATEDRA_BILLING_RPC_CONTRACT=v2` for production `/api/balance` requests.
- Return `503` before creating an admin client or reading wallet state when
  either contract is unavailable.
- Add a runtime regression for the unsafe production configuration.

### Verification

- TDD regression: PASS; the new test was red before the guard and green
  afterward.
- Focused balance tests: PASS (2 tests).
- Full Katedra suite: PASS (130 files, 439 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright local smoke: PASS; `/pisi?tip=d` and `/racun` at 390px and
  1440px had no horizontal overflow or page exceptions. Anonymous `/racun`
  API `401` responses are expected and do not produce page errors.

### Commit

- `603e165 fix: fail closed balance project access`

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Production agentic flags remain disabled until canonical preflight and
  authenticated staging evidence pass.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15i

### Root cause selected

Priority: P0 (state mutation could bypass project locking during production
configuration drift).

`/api/state` only ran its immutable-project checks when
`KATEDRA_PROJECT_LOCKS_ENABLED` was true. If the production flag was missing
or accidentally disabled, an authenticated client could still write a new
topic or work type. The deployment preflight rejected that configuration, but
the route itself did not provide a second fail-closed boundary.

### Fix

- Fail closed with `503` for production `GET` and `PUT /api/state` when the
  project-lock contract is not enabled.
- Make lock configuration read at request time rather than capturing the
  value at module import.
- Add runtime regressions proving the route rejects both reads and writes
  before ownership or persistence work in the unsafe configuration.

### Verification

- TDD regression: PASS; both new tests were red before the route guard and
  green afterward.
- Focused state tests: PASS (8 tests).
- Full Katedra suite: PASS (130 files, 438 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright local smoke: PASS for layout/page behavior at 390px and 1440px;
  anonymous `/racun` produces the expected two `401 /api/account` responses
  in React development mode, with no overflow or page exceptions.

### Commit

- Katedra commit `5725ec3 fix: fail closed state project locks`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Production agentic flags remain disabled until canonical preflight and
  authenticated staging evidence pass.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-15h

### Root cause selected

Priority: P1 (legacy DOCX parsing used only a process-local upload limiter).

### Fix

- Production now fails closed unless the distributed Supabase rate-limit store is configured.
- Production DOCX uploads use the atomic distributed reservation; local development keeps the bounded in-memory limiter.
- Uploads use a server-generated reservation ID and reject oversized multipart requests before parsing.
- New runtime regressions cover missing configuration and unavailable distributed reservations.

### Verification

- TDD regression: PASS; the new runtime tests were red before the route change and green afterward.
- Focused upload/rate-limit tests: PASS (6 files, 13 tests).
- Full Katedra suite: PASS (130 files, 436 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright local smoke: PASS; `/pisi?tip=d` and `/racun` at 390px and
  1440px had no horizontal overflow, page errors or console errors.
- Agentic preflight: expected FAIL-CLOSED; eight staging variables remain
  absent.

### Commit

- Katedra commit `548e8ad fix: harden docx upload rate limiting`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Production agentic flags remain disabled until canonical preflight and authenticated staging evidence pass.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.
- The current canonical reservation RPC applies the shared 2-active/8-per-minute
  envelope; a stricter DOCX-specific 1-active/3-per-minute policy still needs
  a scoped Lekta contract if that product limit is required in production.

## Cycle: 2026-08-15f

### Root cause selected

Priority: P1 (stale `initializing` agent run after a server crash).

The new readiness state was correctly hidden from workers, but it was included
in the per-project active-run uniqueness index without a recovery path. A
process failure between `create_agent_run` and `activate_agent_run` could leave
an old `initializing` row that blocked the next run indefinitely.

### Fix

- Add the owner-scoped `cleanup_stale_initializing_agent_run` Lekta RPC.
- Cancel only an owned project run whose `initializing` state is older than ten
  minutes; active `pending`, `running` and `paused` runs are untouched.
- Call the cleanup RPC before creating a replacement run and fail closed if the
  canonical recovery contract is unavailable.
- Add the RPC to the agent contract preflight and architecture documentation.

### Verification

- TDD regression: red before the cleanup wrapper/route contract/migration
  existed; green after implementation.
- Focused root tests: PASS (13 tests across backend and route contracts).
- Focused Lekta readiness contract tests: PASS (3 tests).
- Full Katedra suite: PASS (129 files, 432 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 generated routes).
- Lekta `npm.cmd run check`: PASS.
- Local Playwright smoke: PASS; `/pisi?tip=d` and `/racun` at desktop/mobile
  widths had no page errors or horizontal overflow.

### Remaining issues

- The new recovery RPC, like the rest of the agent contract, is not deployed
  or concurrency-tested against canonical Supabase; agent flags remain off.
- Other external blockers remain listed in `BLOCKERS.md`.

## Cycle: 2026-08-15e

### Root cause selected

Priority: P1 (agent-run activation race with selected materials).

The agent-run route activated a newly-created run before attaching the user's
selected temporary materials. Because activation makes the run worker-eligible,
a worker could claim the first step in the gap and process an incomplete input
set.

### Fix

- Keep the run in `initializing` after the private manuscript context is stored.
- Attach and validate every selected material while the run is still
  `initializing`.
- Call `activate_agent_run` only after context and material attachment succeed;
  cancel the run on any failure.
- Add a route regression test that requires material attachment before
  activation.
- Synchronize the release preflight documentation with the runtime-required
  `activate_agent_run` RPC.

### Verification

- Regression route test: PASS (4 tests).
- Related agent-run/backend tests: PASS (31 files, 96 tests).
- Full Katedra suite: PASS (129 files, 430 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 generated routes).
- Local Playwright smoke: PASS; `/pisi?tip=d` and `/racun` at desktop/mobile
  widths had no page errors or horizontal overflow.

### Remaining issues

- Authenticated agent-run behavior and canonical RPC deployment remain
  `BLOCKED_EXTERNAL`; local ordering tests are not proof of live worker
  concurrency behavior.
- Other external blockers remain listed in `BLOCKERS.md`.

## Cycle: 2026-08-15d

### Root cause selected

Priority: P1 (agent-run context mutation race).

The context endpoint performed a read of the run status and then accepted a
new private context unless the status was terminal. A `pending` run could be
claimed by the worker between that read and the storage write, allowing a
context overwrite while processing was already active. The initial context is
already stored before `activate_agent_run`, so later context edits do not need
to be accepted during initialization or pending dispatch.

### Fix

- Add the shared `canEditAgentRunContext` policy helper.
- Permit context replacement only for `paused` or `blocked` intervention runs.
- Return `409` for `initializing`, `pending`, `running` and terminal states.
- Update the route contract and runtime fixtures to distinguish paused
  intervention from active worker processing.

### Verification

- Regression test: red before the policy module existed, green after the fix.
- Focused context policy/runtime tests: PASS (7 tests).
- Full Katedra suite: PASS (129 files, 429 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 generated routes).
- Browser smoke: PASS; `/pisi?tip=d` and `/racun` returned 200 with no page
  errors or horizontal overflow.

### Remaining issues

- Authenticated agent-run behavior and canonical RPC deployment remain
  `BLOCKED_EXTERNAL`; the local policy is not proof of live staging behavior.
- Other external blockers remain listed in `BLOCKERS.md`.

## Cycle: 2026-08-15c

### Root cause selected

Priority: P1/P2 (temporary material concurrency and agent-run initialization
readiness).

The material upload route reused the client-controlled `x-request-id` as the
distributed reservation key. Replaying that ID could make concurrent uploads
look like one reservation. Material deletion also matched storage objects by
an arbitrary prefix. Separately, a newly-created agent run was `pending`
before its private manuscript context and selected payloads were registered,
so a worker could claim the intake step too early; context could also be
overwritten while a worker was already running.

### Fix

- Keep the incoming request ID for tracing only and generate a fresh
  server-side reservation ID for every material upload.
- Require a complete UUID for material deletion and resolve only the exact
  manifest plus one exact raw object; reject ambiguous storage state.
- Add the Lekta `initializing` run state and canonical `activate_agent_run`
  readiness transition. New runs become worker-eligible only after the
  private context exists and payloads are attached.
- Allow context edits for initialization/paused/blocked intervention states,
  but reject context replacement while the run status is `running`.
- Add the activation RPC to Katedra's canonical agent preflight contract.

### Verification

- TDD regressions: PASS; the agent-run readiness tests were red before the
  readiness fix and green after it. Material reservation and storage-path
  regressions pass after their minimal fixes.
- Focused root tests: PASS (14 tests for materials, agent-runs and the
  canonical backend wrapper).
- Lekta readiness contract test: PASS (2 tests).
- Full Katedra suite: PASS (128 files, 428 passed, 4 skipped).
- Lekta full `npm.cmd run check`: PASS (typecheck, full Vitest suite and Vite
  build).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 generated routes).
- Browser smoke: PASS; 28 desktop/mobile light/dark route combinations on
  localhost returned 200 with no page errors or horizontal overflow.

### Remaining issues

- The new Lekta migration and activation RPC are local contract evidence only;
  they are not deployed or concurrency-tested against canonical Supabase.
- Authenticated commerce, canonical Lekta deployment, dependency advisory
  audit and staging Golden Journeys remain external blockers in
  `BLOCKERS.md`.

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

## Cycle: 2026-08-14ab

### Root cause selected

Priority: P2 (mojibake navigation labels in onboarding step 3).

The current-state onboarding step rendered the back and next arrows as the
literal mojibake strings `â†` and `â†’`, while the other onboarding steps used
readable Unicode arrows. This was confirmed in the rendered Testing Library
accessible tree, not inferred from a shell display.

### Fix

- Replace both step-3 labels with actual `U+2190` and `U+2192` arrows.
- Add a component regression test that reaches step 3 and rejects the old
  mojibake labels.

### Verification

- TDD regression: PASS; the new test failed against the old rendered labels and
  passed after the minimal text-only fix.
- Focused onboarding tests: PASS (8 tests).
- Full suite: PASS (126 files, 421 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Browser verification: PASS on `localhost:3000` and `127.0.0.1:3000`; step 3
  exposed `← Natrag` and `Dalje →`, with status `200` and no page errors. A
  final route matrix also passed 7 routes × 2 hosts × 2 viewports × 2 themes
  with no overflow, page errors or failed Next asset requests.
- Independent review: PASS, no Critical/Important/Minor findings.

### Commit and journey impact

- Katedra commit: `3e102b6 fix: repair onboarding navigation labels`.
- Affected journeys: G0 and G8 onboarding clarity; no entitlement or backend
  behavior changed.

### Remaining issues

- G2-G7, G9 and G10 remain `BLOCKED_EXTERNAL` pending authenticated staging,
  canonical Lekta deployment and real commerce/provider evidence.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Completion audit: 2026-08-15b

### Result

`V1 PRODUCT COMPLETE` is **not yet proven**. The current local audit found no
new code-fixable P0, P1 or P2 issue after the onboarding and chat-copy fixes,
but G2-G7 and G9-G10 still require the authenticated canonical staging proof
listed in `GOLDEN_JOURNEYS.md` and `BLOCKERS.md`.

### Current evidence

- `npm.cmd test`: PASS (126 files, 421 passed, 4 skipped).
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run lint`: PASS.
- `npm.cmd run build`: PASS.
- Final browser matrix: PASS (7 routes, 2 loopback hosts, desktop/mobile,
  light/dark; no overflow, page errors or failed Next asset requests).
- Source audit: no remaining actual mojibake sequences in `app` or `lib`; the
  only remaining matching test string is an intentional assertion rejecting
  the old malformed arrow.
- `npm.cmd run preflight:agentic`: expected fail-closed; eight staging/worker/
  billing variables remain absent.
- `npm.cmd run audit:dependencies`: BLOCKED_EXTERNAL because the npm advisory
  endpoint was unreachable and npm could not write its local log directory.

### Completion decision

Keep the autonomous goal active. Do not enable agentic flags or claim V1
complete until the canonical Lekta migration/RPC deployment, real concurrent
lock proof, authenticated Stripe/Supabase/provider journeys and dependency
audit are available.

## Cycle: 2026-08-15a

### Root cause selected

Priority: P2 (mojibake in a user-facing chat recovery error).

When project AI balance data was unavailable or non-numeric, `/api/chat` did
return the correct fail-closed `503` and released the reservation, but the
Croatian message contained the literal mojibake sequence `Ä‡` instead of `ć`.
The issue was confirmed by inspecting the runtime string code points and a
response-payload regression assertion.

### Fix

- Replace the malformed character with the actual `U+0107` character.
- Assert the complete user-facing error payload while preserving status,
  reservation release, authorization and billing behavior.

### Verification

- TDD regression: PASS; the exact response assertion failed before the copy fix
  and passed afterward.
- Focused chat runtime tests: PASS (12 tests).
- Full suite: PASS (126 files, 421 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Independent review: PASS, no Critical/Important/Minor findings.

### Commit and journey impact

- Katedra commit: `d1ce19c fix: correct chat wallet error copy`.
- Affected journey: G9 recovery messaging; no access, billing or persistence
  semantics changed.

### Remaining issues

- G2-G7, G9 and G10 remain `BLOCKED_EXTERNAL` where authenticated provider,
  commerce or Lekta evidence is required.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.

## Cycle: 2026-08-14aa

### Root cause selected

Priority: P0 (paid project lock accepted malformed canonical RPC output).

`lockPaidProject` previously synthesized a successful immutable lock snapshot
when the RPC returned only a lock ID, a string, or another unexpected shape.
That could let the webhook continue toward entitlement creation without proof
that Lekta had returned the requested user, project, topic, product and payment
identity.

### Fix

- Require exactly one canonical lock row for array RPC responses.
- Require `lock_id`, project/user identity, topic, work type, product key,
  payment ID and `locked_at` before accepting a lock.
- Compare the returned immutable fields with the checkout request.
- Fail closed for malformed RPC and read envelopes, malformed stored rows and
  identity mismatches.
- Align webhook and capability test doubles with the real Lekta RPC contract.

### Verification

- TDD regression: PASS; malformed lock tests failed before the strict parser and
  pass after it.
- Focused project-lock/webhook/capability tests: PASS (24 tests).
- Full suite: PASS (126 files, 420 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Playwright smoke: PASS on `localhost:3000` and `127.0.0.1:3000`, desktop and
  mobile, light and dark; target routes returned `200`, with no overflow, page
  errors or failed Next asset requests.
- Independent review: no Critical or Important Katedra-wrapper findings.

### Remaining issues

- A local Lekta follow-up migration (`0074_atomic_project_lock_idempotency.sql`)
  now adds atomic conflict handling and deterministic row-lock reconciliation
  for `lock_paid_project`. It is committed in Lekta as `cb1b16f`, but has not
  been deployed or proven against the canonical Supabase project.
- Dependency audit could not reach the npm advisory endpoint in this
  environment; rerun it in a network-enabled release environment.
- Authenticated commerce, canonical Lekta deployment and staging browser
  journeys remain external blockers.

## Cycle: 2026-08-14y

### Root cause selected

Priority: P0 (client-controlled chat idempotency identity).

`/api/chat` reused the bounded incoming `x-request-id` as the distributed
reservation and `katedra_consume` idempotency key. A caller could replay that
header and potentially turn a previously settled key into a new AI response
without a fresh billing attempt.

### Fix

- Keep the incoming ID only as tracing/response identity.
- Generate a fresh server UUID for each billable chat request.
- Use that UUID for reservation and `katedra_consume`.
- Include the server billing ID in billing reconciliation and reservation
  release-failure logs.
- Add a two-request regression using the same client header and assert distinct
  server IDs with matching reservation/settlement identities.

### Verification

- TDD regression: PASS; the pre-fix implementation forwarded
  `reused-client-id`, then the fixed implementation passed the two-request
  assertion.
- Focused chat/observability/rate-limit tests: PASS (20/20).
- Scoped review and re-review: PASS; no Critical, Important or Minor findings
  remain.
- Full suite: PASS (126 files, 413 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Fresh Playwright `/pisi?tip=d` smoke: PASS on `localhost:3000` and
  `127.0.0.1:3000`, with no page errors or Next static-asset failures.

### Commit

- `6514a68` fix: isolate chat billing request identity
- `1ac167f` test: strengthen chat billing identity regression

### Remaining issues

- Live idempotent billing behavior still requires canonical Lekta RPC/RLS and
  authenticated staging proof; local tests cannot replace that external gate.
- Authenticated commerce and remaining Golden Journeys remain the external
  blockers listed in `BLOCKERS.md`.

## Cycle: 2026-08-14z

### Independent UX and release audit

The post-P0 audit found no new code-fixable P0, P1 or P2 defect. Fresh browser
checks covered `/`, `/pisi?tip=d`, `/racun`, `/prijava`, `/privatnost` and
`/uvjeti` on both `localhost` and `127.0.0.1`, at desktop and mobile widths,
with light and dark theme rendering.

### Evidence

- All inspected routes rendered successfully without horizontal overflow in
  either theme or viewport.
- `/pisi` onboarding and Completion Scan rendered with a clear next action.
- The only console 401 responses came from expected anon calls to
  auth-protected account/balance endpoints; there were no page errors.
- `npm.cmd run audit:dependencies` remains `BLOCKED_EXTERNAL` because the npm
  advisory endpoint was unavailable; this is recorded in `BLOCKERS.md`.

### Remaining issues

- G2-G7, G9-G10 still require authenticated Supabase/Stripe/Lekta staging.
- Agentic flags remain disabled until canonical RPC/RLS/worker preflight passes.
- Dependency security status requires a network-enabled advisory audit.

## Cycle: 2026-08-14x

### Root cause selected

Priority: P2 (Next.js development asset guard blocked the loopback browser
origin `127.0.0.1`, leaving `/pisi` stuck before hydration).

### Fix

- Allow both `localhost` and `127.0.0.1` through Next's `allowedDevOrigins`.
- Add a regression assertion covering both local origins.

### Verification

- TDD regression: PASS (red before the config change, green afterward).
- Focused regression: PASS (2/2).
- Full suite: PASS (126 files, 413 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (exit `0`).
- Fresh Playwright checks: PASS for `/pisi?tip=d` on both local origins;
  both returned `200`, onboarding was visible, no Next static asset response
  was `>=400`, and no page errors occurred.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment and staging browser
  journeys remain the external blockers listed in `BLOCKERS.md`.
- Local feature flags remain disabled until the canonical Lekta preflight passes.

## Cycle: 2026-08-14t

### Root cause selected

Priority: P2 (cross-platform Lekta release-gate instability).

On Windows, two Lekta Node ESM generator files were checked out with CRLF
line endings even though the Vite-driven tests require LF. A generated
real-corpus comparison also treated CRLF and LF as different output, which
made the full Lekta gate report unrelated syntax and snapshot-like failures.

### Fix

- Add a Lekta `.gitattributes` rule that keeps `*.mjs` files on LF across
  checkouts.
- Normalize the real-corpus comparison to LF before asserting generated
  markdown equality.
- Record the coordinated Lekta fix in commit `cd7233f`.

### Verification

- Lekta focused agentic tests: PASS (4 files, 11 tests).
- Lekta full `npm run check`: PASS (TypeScript, full Vitest suite and Vite
  production build; exit `0`).
- Katedra gates from the preceding cycle remain PASS (full suite, typecheck,
  lint, production build and Playwright smoke).

### Remaining issues

- Dependency audit could not reach the npm advisory endpoint in this
  environment; rerun it in a network-enabled release environment.
- Authenticated commerce, canonical Lekta deployment and staging browser
  journeys remain the external blockers listed in `BLOCKERS.md`.
- Agentic feature flags remain disabled until the canonical Lekta migrations,
  RPC/RLS, worker, TTL cleanup and authenticated staging preflight are
  deployed and verified.

## Cycle: 2026-08-14u

### Root cause selected

Priority: P0 (shared-state privacy boundary bypass).

`PUT /api/state` copied `lektaIssues` into the compatibility backend without a
server-side allowlist, while `GET /api/state` returned the stored JSON as-is.
That allowed document-derived `detail`, `location`, source passages, mentor
comments, document text and unknown fields to cross the local-first boundary
despite the Product Constitution and shared schema forbidding them.

### Fix

- Add one bounded, fail-closed `lektaIssues` sanitizer.
- Apply it before PUT persistence and again when mapping GET responses.
- Add PUT and GET regressions for prohibited fields, unknown keys and oversized
  labels.
- Keep the fix in Katedra route state only; no competing database migration was
  introduced.

### Verification

- TDD regression: PASS; the route-only sanitizer was reversibly removed and
  both new tests failed for the expected leakage before restoration.
- Focused state tests: PASS (6 passed, 1 staging integration skipped).
- Full Katedra suite: PASS (126 files, 408 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS.
- Diff check: PASS; only unrelated pre-existing CRLF normalization warnings.
- Task review and scoped re-review: PASS; no Critical or Important findings.

### Commit

- `002e643 fix: sanitize Lekta state issues`

### Remaining issues

- The canonical Lekta backend still needs the corresponding one-time cleanup
  and deployed contract verification if contaminated legacy rows exist there;
  Katedra now redacts such rows on read and prevents new writes.
- Authenticated commerce, canonical Lekta deployment and staging browser
  journeys remain the external blockers listed in `BLOCKERS.md`.
- A separate P1 remains in the canonical `resume_agent_run` RPC: direct
  authenticated RPC callers need active project-specific Pass/expiry checks;
  Katedra's HTTP route already checks this boundary.

## Cycle: 2026-08-14v

### Root cause selected

Priority: P1 (canonical direct-RPC resume authorization gap).

Lekta's original `resume_agent_run` updated any paused run owned by the caller
without rechecking that the project's lock was still active and that the exact
project-specific Katedra Pass was active and unexpired. Katedra's HTTP route
performed a similar check, but the canonical database RPC remained a bypass.

### Fix

- Add Lekta migration `0073_harden_katedra_agent_resume_scope.sql`.
- Require the paused run owner, locked project, exact `katedra_pass_` product,
  active entitlement and `purchase_expires_at > now()` in the atomic UPDATE.
- Harden the SECURITY DEFINER search path with `public, pg_temp` and assert it
  in the contract test.
- Keep all database authority in Lekta; no Katedra migration was added.

### Verification

- TDD regression: PASS; the new contract test failed before migration 0073 and
  passed after it; the fix-round search-path assertion also had a red/green
  cycle.
- Focused Lekta tests: PASS (7 tests).
- Lekta full `npm.cmd run check`: PASS (309 files, 3,780 tests, Vite build).
- Scoped review and re-review: PASS for SQL behavior and fix diff.

### Commits

- Lekta `c2b0777` initial resume entitlement guard.
- Lekta `22ab983` SECURITY DEFINER search-path hardening.

### Remaining issues

- Live positive/negative RPC behavior is not proven because the migration is
  not applied to canonical Supabase staging; this remains `BLOCKED_EXTERNAL`,
  not a claim of release readiness.
- Authenticated commerce, canonical deployment and staging browser journeys
  remain the external blockers listed in `BLOCKERS.md`.

## Cycle: 2026-08-14w

### Root cause selected

Priority: P2 (agentic staging preflight did not match worker safety
requirements).

The preflight accepted a configuration with worker/model/feature-flag values
even when the worker's mandatory billing RPC v2 and distributed Supabase
rate-limit contracts were missing or set to legacy values. The environment
template and blocker evidence also omitted two required worker variables.

### Fix

- Require `KATEDRA_BILLING_RPC_CONTRACT=v2` and
  `KATEDRA_RATE_LIMIT_STORE=supabase` in the preflight.
- Distinguish missing from invalid values without exposing secrets.
- Add worker URL and cron-secret placeholders to `.env.example`.
- Synchronize release/blocker documentation and test exclusive bucket
  classification.

### Verification

- TDD regressions: PASS; four new missing/invalid cases were red before the
  preflight change and green afterward.
- Focused preflight tests: PASS (8 tests).
- Katedra full suite/typecheck/lint/build: PASS on implementation commit
  `0b72706` (412 passed, 4 skipped).
- Local preflight: intentionally FAIL-CLOSED, now listing all eight missing
  staging variables/contracts without values.
- Commit/diff review: PASS after the documentation and assertion fix in
  `5a033b9`.

### Remaining issues

- Canonical Lekta deployment, live Supabase RPC/RLS proof, authenticated
  commerce and staging browser journeys remain external blockers.
- Local feature flags remain disabled.

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
## Cycle: 2026-08-15g

### Root cause selected

Priority: P0 (production `/api/chat` could reach the legacy path when
project-lock enforcement was not enabled).

The deployment preflight already required project-lock enforcement, but the
route itself did not fail closed before parsing the request and creating an
admin client. A production configuration drift or a missing flag could
therefore bypass the paid project-capability boundary. The account endpoint
also represented an unavailable usage query as confirmed zero usage without a
warning.

### Fix

- Fail closed in production from `/api/chat` with `503` when
  `KATEDRA_PROJECT_LOCKS_ENABLED` is not exactly `true`.
- Add a runtime regression proving the route does not create an admin client
  in that configuration.
- Add an account warning when the AI usage query is unavailable, while
  retaining a safe zero-shaped response for existing clients.
- Update production runtime test fixtures so downstream rate-limit and billing
  tests explicitly exercise the locked project path.

### Verification

- TDD regression: PASS; the new production lock test failed before the route
  guard and passed after it. The account warning test also failed before the
  warning was added and passed afterward.
- Focused route tests: PASS (18 tests).
- Full Katedra suite: PASS (129 files, 434 passed, 4 skipped).
- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (24 routes).
- Playwright local smoke: PASS; `/pisi?tip=d` and `/racun` at 390px and
  1440px had no horizontal overflow, page errors or console errors.
- Diff and selected-file review: PASS.

### Commits

- Katedra commit `ce5e1bb fix: fail closed chat project access`.

### Remaining issues

- Authenticated commerce, canonical Lekta deployment, live RPC/RLS proof and
  staging browser journeys remain external blockers listed in `BLOCKERS.md`.
- Production agentic flags remain disabled until the canonical preflight and
  authenticated staging evidence pass.
- Dependency audit remains blocked by the unavailable npm advisory endpoint.
