# Katedra Master Stabilization Report

**Audit date:** 2026-08-14  
**Scope:** repository reproducibility and release-validation readiness  
**Status:** local code gates verified; external production checks remain pending

## Executive summary

The repository has a passing local TypeScript check, lint check, test suite, dependency audit, production smoke, and Next production build. The current local release gate is 72 test files with 200 passing tests and 4 intentionally skipped staging tests; the build generates 18 routes. The tracked environment contract lists every required runtime variable, with server-only values represented only by safe placeholders.

The remaining launch blockers are configuration and external-system checks: protected production secrets, Resend sender configuration, Supabase Auth redirect configuration, payment/webhook verification, and the coordinated Lekta/Katedra production smoke. These cannot be safely verified with local placeholder values.

## Verified command evidence

| Check | Command | Result | Evidence |
|---|---|---|---|
| Dependency installation | `npm ci` | PASS | Clean lockfile install in an isolated temporary directory; 559 packages added, 560 audited, 0 vulnerabilities |
| TypeScript | `npm run typecheck` | PASS | `tsc --noEmit` exited 0 |
| Lint | `npm run lint` | PASS | ESLint exited 0 |
| Tests | `npm run test:ci` | PASS | 72 test files, 200 tests passed; 4 staging tests skipped without `KATEDRA_INTEGRATION_URL` |
| Production build | `npm run build` | PASS | Next production build generated 18 routes |
| Local production smoke | `npm run start` + `GET /` | PASS | Local server returned HTTP 200; cleanup was limited to the process tree started by the smoke test |
| Auth redirect hardening | `npx vitest run lib/auth/redirect.test.js` | PASS | 8 redirect-safety tests passed; external and malformed targets fall back to `/pisi` |
| Auth header state | `npx vitest run lib/auth/header-state.test.js` | PASS | 3 tests passed; browser session remains visible when balance backend is unavailable |
| Environment inventory | PowerShell source-reference scan | PASS | 10 application variables documented in `.env.example`; `NODE_ENV` is runtime-provided |
| Secret scan | tracked configuration scan | PASS | no live secret pattern found in `.env.example` |
| Live Supabase schema/RPC audit | read-only project introspection | FAIL release gate | legacy `katedra_consume` only; v2 RPCs and `withdrawal_requests` absent |
| Production preflight in local shell | `npm run preflight:production` | EXPECTED FAIL | protected deployment variables are not loaded into this local process environment |
| Git workflow | `git status` / branch / fetch | UNVERIFIED | Git executable is unavailable in this execution environment |
| Live integrations | authenticated Supabase, Stripe, Anthropic, Resend | UNVERIFIED | protected credentials and external release access were not used |

`npm audit --omit=dev --json` now passes with 0 vulnerabilities after the
minimal Next 16.3.0 / `eslint-config-next` update and the targeted PostCSS
`nanoid` 3.3.18 override. The clean lockfile install also reported 0
vulnerabilities. The main workspace `npm ci` was blocked by an existing Windows
file lock from running Node processes; the isolated clean install is the
reproducible dependency evidence.

Additional local evidence now includes:

- authenticated chat runtime coverage for provider streaming, request identity,
  billing settlement, reservation release, project-scoped balance, and
  insufficient estimated balance;
- atomic reservation payload coverage with `p_estimated_charge`;
- attachment-size-aware cost estimation;
- webhook runtime coverage preventing a sequential duplicate active Pass grant.
- browser storage exception coverage so IndexedDB remains the manuscript
  authority when legacy `localStorage` metadata is blocked or full.
- proposal application coverage preventing an invalid or stale selection from
  silently becoming an append operation.
- distributed withdrawal reservation coverage for duplicate, rate-limit,
  commit, release, and unavailable-contract outcomes.
- withdrawal route runtime coverage proving a missing live table returns 503
  and releases its reservation.
- malformed withdrawal JSON coverage proving invalid bodies return 400 before
  any reservation.
- account-page coverage proving each withdrawal confirmation sends a stable
  reference ID, plus attachment payload ceiling coverage before provider use.
- manuscript link coverage proving the Tiptap link extension is registered,
  unsafe URL marks are rejected from backups, and unsafe links are omitted from
  DOCX export.
- duplicate paid Pass coverage proving a second active-project purchase is
  refunded with an idempotency key and fails closed when Stripe cannot refund
  it.
- entitlement detection accepts both the current `product_id IS NULL` Pass
  shape and the planned `katedra_pass_*` catalog SKUs, while rejecting
  unrelated Stripe catalog products.
- browser release-gate configuration no longer hardcodes a historical Lekta
  preview URL; CI now reads `LEKTA_PREVIEW_URL` from protected secrets.
- authenticated browser release gate is checked in at
  `scripts/authenticated-money-flow-e2e.mjs`; it fails closed without a
  staging URL and dedicated test account, and records the AI response request
  identity without printing credentials.
- authentication form coverage now verifies explicit label/input association
  and accessible error announcements across login, registration, password
  recovery and password reset.
- `/pisi` hardening coverage now verifies proposal section/revision guards,
  cancellation of late AI streams, loss-resistant autosave flushing,
  malformed IndexedDB recovery, safe text import validation, and visible
  snapshot failure handling.
- `/pisi` accessibility coverage now verifies keyboard faculty/program
  combobox selection, Escape dismissal, focus trapping and restoration for
  project/Pass dialogs, mobile context announcements, dark-mode interactive
  surface contrast, and reduced-motion contracts.
- the manual GitHub release workflow now validates the Lekta preview URL,
  staging URL and dedicated auth test credentials before starting browser E2E;
  missing release configuration fails immediately.
- a reproducible read-only SQL contract audit is checked in at
  `scripts/academic-suite-contract-audit.sql` for the Lekta release owner.
- official Anthropic model documentation confirms the configured Sonnet 5,
  Opus 5, and Haiku 4.5 identifiers used by the chat route.

## Auth audit

The unauthenticated localhost audit verified:

- `/prijava`, `/registracija`, `/zaboravljena-lozinka`, `/reset-lozinke`, and guest-first `/pisi` return HTTP 200;
- `/api/state`, `/api/balance`, `/api/chat`, `/api/checkout`, `/api/withdrawal`, and `/api/parse-docx` return HTTP 401 without a session;
- `/auth/callback` without a code returns a 307 redirect to `/prijava?error=auth_callback_failed`;
- the configured Supabase Auth settings endpoint returned HTTP 200;
- the login redirect parameter is now constrained to same-origin relative paths by `lib/auth/redirect.js`, shared by the login page and auth callback.
- the main Katedra header now reads the browser Supabase session independently from `/api/balance` and shows `✅ Prijavljen` even when Pass/balance lookup is unavailable;
- Pass status is shown only when the balance response is available, preventing a balance error from being misreported as logout.

The local dev log reproduced the underlying configuration condition: `/api/balance` reached `createAdminClient()` and reported `Nedostaju SUPABASE env varijable za admin client.` because the local secret store does not contain `SUPABASE_SERVICE_ROLE_KEY`. The key must be added locally from the same Lekta Supabase project before balance, free-starter grant, chat, and payment server paths can work normally; never commit or paste that value.

An interactive signup/login/password-reset flow still requires a human-operated test account. No account was created and no password was handled by the audit.

## Environment contract

The following application-read variables are documented in `.env.example`:

### Public/runtime configuration

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

### Server-only secrets or protected configuration

- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `WITHDRAWAL_FROM_EMAIL`
- `KATEDRA_BILLING_RPC_CONTRACT`
- `KATEDRA_RATE_LIMIT_STORE`

`NODE_ENV` is supplied by the runtime and is not a secret-store input in `.env.example`.

Never copy values from `.env.local` into tracked files or paste them into chat, issues, commits, or documentation.

## Live Supabase verification — read-only, 2026-08-13

The connected Lekta Supabase project was inspected without applying SQL or
reading customer rows. The live schema confirms:

- `academic_projects`, `katedra_project_state` and `katedra_projects` exist;
- `katedra_projects_shared_sync` mirrors the compatibility row into the
  canonical project/state tables and rejects a cross-user canonical project
  ownership conflict;
- canonical project and state RLS policies use `auth.uid()` ownership checks;
- the only live `katedra_consume` signature is the legacy
  `(p_user, p_charged, p_model, p_in, p_out) -> bigint` function;
- live `katedra_consume` has no `p_project_id` or `p_request_id` and is not
  idempotent by request identity;
- `katedra_reserve_request`, `katedra_release_request`,
  `katedra_authorize_project_ai`, and all withdrawal reservation/commit
  functions are absent;
- `withdrawal_requests` is absent from the connected schema.

The connected live schema also contains the adjacent Lekta
`completion_ai_reserve` / `completion_ai_finalize` contract and its
`completion_ai_usage` model. Those functions are not interchangeable with
Katedra billing: they require a `completion_tasks` capability context, return
usage identifiers rather than request-id settlement states, and do not perform
the Katedra wallet debit or withdrawal reservation. The exact comparison and
required signatures are recorded in
`docs/architecture/LEKTA_KATEDRA_RPC_IMPLEMENTATION_BRIEF.md`.

Read-only GitHub discovery found two relevant Lekta proposals that are not
merged and therefore are not production evidence: [PR #29](https://github.com/danielrisavi77-create/Lekta/pull/29)
proposes `withdrawal_requests`, and [PR #31](https://github.com/danielrisavi77-create/Lekta/pull/31)
proposes catalog rows for Katedra Pass products. The former does not by itself
provide the full reservation/commit RPC contract, and neither PR provides the
missing Katedra request-id billing settlement functions.

This is direct evidence for keeping production AI fail-closed until Lekta
deploys the v2 contracts. The Supabase advisor also reported unrelated legacy
database lints; those require a separate Lekta-owned cleanup and were not
changed from Katedra.

## Findings by priority

| ID | Priority | Finding | Impact | Resolution/owner |
|---|---|---|---|---|
| STAB-001 | P0 | Live Supabase exposes only the legacy non-idempotent `katedra_consume(p_user, p_charged, p_model, p_in, p_out)`; v2 billing/access/reservation RPC contracts are absent | Chat must remain fail-closed; paid AI flow cannot be declared safe | Deploy and integration-test the v2 billing, access and reservation contracts in Lekta; Lekta owner |
| STAB-002 | P1 | Production secrets, verified Resend sender and release flags are not confirmed in a protected deployment | Checkout, chat, withdrawal and atomic limits cannot be released safely | Configure and run production preflight; deployment owner |
| STAB-003 | P1 | Authenticated/payment/chat/live Academic Suite flows were not exercised with production-like credentials | Local gates do not prove external integration behavior | Run the full staging money-flow and failure matrix; deployment owner |
| STAB-004 | P1 | Coordinated Lekta/Katedra release and production Auth redirect configuration are not evidenced | Shared identity and production callback behavior can remain unavailable even with a green local build | Complete the paired release steps and verify exact production callback URLs; Lekta/Katedra deployment owners |
| STAB-005 | P1 | Withdrawal now has a durable adapter, but the live schema lacks `withdrawal_requests` and the Lekta reservation/release/commit RPC contract | Withdrawal cannot be accepted or idempotently rate-limited in production | Deploy and integration-test the withdrawal table plus `katedra_reserve_withdrawal` / `katedra_release_withdrawal` / `katedra_commit_withdrawal`; Lekta owner |
| STAB-006 | P2 | `/api/state` still uses the temporary `katedra_projects` compatibility write path | The compatibility path creates migration/retirement debt, although the live sync trigger and RLS ownership checks are present | Keep the trigger under observation, then migrate the route to direct canonical state writes in a coordinated Lekta release |
| STAB-007 | P2 | Historical launch documentation contains dates and open items that require ongoing manual updates | Operators can mistake historical evidence for current release status | Use this report and the stabilization checklist as the current local baseline; update `PRELAUNCH.md` when external items change |
| STAB-008 | RESOLVED (P2) | The earlier audit environment did not expose a Git executable | The historical limitation no longer applies: Git is now available at `C:\\Program Files\\Git\\cmd\\git.exe`, and branch status, isolated commits, and diff checks have been verified locally; network access to `github.com:443` remains a separate external limitation | Resolved 2026-08-15; keep origin synchronization as a deployment-environment check |
| STAB-009 | P2 | Main-workspace clean install is blocked by an existing Windows Node file lock | Local process hygiene can prevent exact reinstall verification | Stop only the known local process tree in a maintenance window; isolated clean install already passes |
| STAB-010 | P2 | Login redirect accepted an unsanitized query parameter | Could allow an external navigation after successful login | Resolved with shared same-origin redirect validation and 8 regression tests |

## Database authority invariant

Katedra does not own production Academic Suite schema migrations. The existing file `supabase/migrations/20260805010000_academic_suite_foundation_hardening.sql` is a deprecated no-op migration-history marker containing comments only. Authoritative production migrations remain in the Lekta repository.

Do not add production DDL here, apply the local marker as schema authority, or create a second entitlement/product database model.

## Release readiness

The local repository gates are ready for repeatable execution. Production launch is not yet clear until the P0/P1 external checks are evidenced:

- protected Supabase, Stripe, Anthropic, and Resend configuration is present;
- Resend uses a verified production sender, not `onboarding@resend.dev`;
- Supabase Auth allows the exact Katedra production and callback URLs;
- paired Lekta/Katedra CI and deployment checks are green;
- Lekta atomic billing, reservation and project-access RPC tests pass;
- one non-sensitive authenticated project/chat/payment/document handoff smoke passes;
- no raw document content enters the shared backend.

## Next verification

Run [the stabilization checklist](stabilization-checklist.md) from a Git-enabled developer shell, then update this report with the actual branch/origin state and external smoke evidence.
