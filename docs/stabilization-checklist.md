# Katedra Stabilization Checklist

Use this checklist before opening a PR or promoting a release. Run it from the repository root. Do not print `.env.local` or any secret value.

## 1. Repository state

```powershell
git status --short --branch
git branch --show-current
git fetch origin
```

Expected:

- work is on an intentional feature branch, not directly on `master`;
- existing user changes are understood and preserved;
- `origin` is reachable and the branch is compared with current `origin/master`.

If Git is unavailable, stop this checklist and run it from a Git-enabled developer shell.

## 2. Exact dependency installation

```powershell
npm ci
```

Expected: dependencies install from `package-lock.json` with exit code 0.

## 3. Code gates

Run each command and require exit code 0:

```powershell
npm run audit:dependencies
npm run typecheck
npm run lint
npm run test:ci
npm run build
```

Expected: all unit/component tests pass. Staging integration tests are skipped
unless `KATEDRA_INTEGRATION_URL` points to a running test deployment. The
production build must compile and generate the application routes without a
fatal error.

For `/pisi`, additionally verify the local-first editor contract:

- switching sections cancels an in-flight AI request and clears its proposal;
- a proposal can be accepted only for its original section and revision;
- `pagehide` flushes the current manuscript before the IndexedDB store closes;
- malformed stored data and invalid `.txt`/`.md` imports fail closed;
- keyboard users can select catalog options, close dialogs with Escape, and
  keep focus inside an open drawer/dialog;
- mobile navigation announces the active context and dark mode keeps editor,
  proposal, form and status text readable.

## 4. Environment contract

For a production deployment, run the preflight from the protected deployment
environment. It prints variable names only, never secret values:

```powershell
npm run preflight:production
```

Require exit code 0 before deploying.

Confirm the deployment secret store contains the required values without printing them:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
WITHDRAWAL_FROM_EMAIL
NEXT_PUBLIC_APP_URL
KATEDRA_BILLING_RPC_CONTRACT
KATEDRA_RATE_LIMIT_STORE
```

The browser E2E workflow also requires the protected CI variable
`LEKTA_PREVIEW_URL`. It must point to the coordinated Lekta preview/staging
deployment for the current release; do not hardcode a historical Netlify
deploy-preview URL in the workflow.

`WITHDRAWAL_FROM_EMAIL` must be a verified production-domain sender. Do not use `onboarding@resend.dev` in production. Keep `SUPABASE_SERVICE_ROLE_KEY`, Anthropic, Stripe, and Resend credentials server-only.

## 5. Local production smoke

After `npm run build` succeeds, start the production server and request the root page:

```powershell
$proc = Start-Process npm -ArgumentList 'run','start' -WorkingDirectory (Get-Location) -PassThru -WindowStyle Hidden
try {
  Start-Sleep -Seconds 5
  (Invoke-WebRequest http://localhost:3000/ -UseBasicParsing).StatusCode
} finally {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
```

Expected: HTTP status `200` for `/`. If port 3000 is occupied or startup fails, record the exact error and resolve that environment issue before release.

Do not use real customer data, real documents, or production payment credentials for this local smoke.

## 6. Academic Suite authority guard

Confirm that:

- production Academic Suite migrations remain in the Lekta repository;
- `supabase/migrations/20260805010000_academic_suite_foundation_hardening.sql` remains a comment-only no-op marker;
- no raw `.docx` or document body text is added to shared Katedra/Lekta tables;
- Katedra does not create a second entitlement or product authority.

## 7. External release smoke

Follow the detailed [staging money-flow runbook](release/STAGING_MONEY_FLOW.md)
for the authenticated checkout, webhook, wallet, chat, reconciliation and
failure matrix. This section is the evidence checklist; the runbook defines
the exact expected outcomes and cleanup steps.

Before enabling production flags, run the read-only
[`scripts/academic-suite-contract-audit.sql`](../scripts/academic-suite-contract-audit.sql)
against the canonical Lekta Supabase project and attach its result to the
release evidence. It must show the v2 function signatures, withdrawal table,
canonical sync trigger and owner-scoped policies.

Only after protected staging/production configuration is approved:

- sign in with a permanent Supabase account;
- verify `/auth/callback` returns to Katedra;
- create and save one project;
- verify the shared project/state mirror behavior;
- exercise chat with the configured Anthropic capability;
- complete a Stripe test-mode checkout and webhook round trip;
- submit a withdrawal request and verify the Resend sender;
- complete the non-sensitive Lekta handoff/recheck flow;
- confirm raw document content is not persisted in shared tables.
- verify Lekta exposes `katedra_reserve_request`, `katedra_release_request`,
  `katedra_authorize_project_ai`, and idempotent v2 `katedra_consume` before
  enabling the matching Katedra environment flags;
- verify Lekta exposes idempotent `katedra_reserve_withdrawal` and
  `katedra_release_withdrawal` and `katedra_commit_withdrawal` before
  accepting production withdrawal requests;
- verify a wallet grant from project A cannot authorize AI use in project B.

Run the HTTP integration gate against the same staging deployment:

```powershell
$env:KATEDRA_INTEGRATION_URL='https://staging.example'
npm run test:ci -- app/api/checkout/route.integration.test.js app/api/chat/route.integration.test.js app/api/webhook/route.integration.test.js app/api/state/route.integration.test.js
```

For the full authenticated money-flow, use a dedicated test account and test
Stripe/Supabase/Anthropic credentials. The flow must cover duplicate webhook,
checkout refresh/close, expired Pass, empty wallet, two tabs, interrupted
stream, provider 500/429, Supabase timeout, and a foreign project ID. Do not
use production credentials or real student documents.

Record the date, environment, account/test identifiers (never credentials), and result in the release checklist.

## 8. Evidence handoff

Update [the stabilization report](stabilization-report.md) with:

- command exit codes and test counts;
- branch/origin state;
- external smoke results;
- any remaining P0/P1 blockers;
- the person responsible for each external blocker.
