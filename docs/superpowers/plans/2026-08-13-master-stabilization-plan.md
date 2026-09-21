# Master Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current Katedra repository reproducible for local development and release validation while preserving the existing Academic Suite architecture and application behavior.

**Architecture:** Keep application routes, auth, checkout, webhook, chat, and shared contracts unchanged. Improve the repository contract through explicit npm verification scripts, complete environment documentation, and synchronized stabilization/release documentation. Keep Lekta as the sole production database migration authority.

**Tech Stack:** Next.js 16, React 19, TypeScript, ESLint 9, Vitest 4, Supabase SSR/client, Stripe, Resend, PowerShell development scripts.

## Global Constraints

- Do not add production Academic Suite DDL or a competing migration authority to this repository.
- Do not expose, copy, or print values from `.env.local` or any server-only secret.
- Do not change application route behavior, auth contracts, payment behavior, webhook semantics, chat behavior, or shared Academic Suite contracts.
- Preserve the local SQL file as a deprecated/no-op migration-history marker.
- Use actual command exit codes and output in the final stabilization report.
- Git branch/status/fetch checks remain environment-dependent because Git is unavailable in the current execution environment.

---

### Task 1: Add explicit verification scripts

**Files:**
- Modify: `package.json:scripts`
- Test: `package-lock.json` remains unchanged because no dependency changes are needed.

**Interfaces:**
- Produces `npm run typecheck` as the canonical TypeScript gate.
- Produces `npm run test:ci` as the canonical non-watch test gate.

- [ ] **Step 1: Add the two scripts without changing dependencies**

Add these entries beside the existing `lint`, `test`, and `test:watch` scripts:

```json
"typecheck": "tsc --noEmit",
"test:ci": "vitest run"
```

- [ ] **Step 2: Verify the new scripts are discoverable**

Run:

```powershell
npm run
```

Expected: output includes `typecheck` and `test:ci`.

- [ ] **Step 3: Run the new scripts**

Run:

```powershell
npm run typecheck
npm run test:ci
```

Expected: both exit with code 0.

- [ ] **Step 4: Review the dependency diff**

Run:

```powershell
git diff -- package.json package-lock.json
```

Expected: only `package.json` scripts changed; no dependency or lockfile change is introduced. If Git is unavailable, inspect both files directly and record that Git verification was unavailable.

---

### Task 2: Complete the tracked environment contract

**Files:**
- Modify: `.env.example`
- Test: `app/api/withdrawal/route.js`, `app/api/chat/route.js`, `app/api/checkout/route.js`, `app/api/webhook/route.js`, `lib/stripe.js`, `lib/supabase/admin.ts`, `lib/supabase/client.js`, `lib/supabase/server.js`

**Interfaces:**
- `.env.example` documents every `process.env.*` variable used by the application.
- Server-only values remain placeholders and are clearly marked as deployment secrets.

- [ ] **Step 1: Add missing Resend variables**

Add the following after the existing application secrets in `.env.example`:

```env
# Server-only. Required for production withdrawal confirmation emails.
RESEND_API_KEY=REPLACE_IN_DEPLOYMENT_SECRET_STORE

# Server-side sender identity. Must be a verified production domain address.
# Do not use onboarding@resend.dev in production.
WITHDRAWAL_FROM_EMAIL=REPLACE_WITH_VERIFIED_SENDER_ADDRESS
```

- [ ] **Step 2: Preserve public/server boundaries**

Confirm that only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_APP_URL` are documented as public values. Confirm that `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `RESEND_API_KEY` remain server-only placeholders.

- [ ] **Step 3: Compare the environment list to source references**

Run:

```powershell
Get-ChildItem app,lib -Recurse -File | Select-String -Pattern 'process\.env\.[A-Za-z0-9_]+'
```

Expected: every listed variable is either present in `.env.example` or is a platform-provided runtime value such as `NODE_ENV`.

- [ ] **Step 4: Scan tracked configuration for secret values**

Run:

```powershell
Select-String -Path .env.example,README.md,PRELAUNCH.md,docs/**/*.md -Pattern 'sk_live_|sk_test_|whsec_|service_role|REPLACE_IN_DEPLOYMENT_SECRET_STORE' -SimpleMatch
```

Expected: only safe placeholders and documentation labels are present; no live secret appears.

---

### Task 3: Create the stabilization report and repeatable checklist

**Files:**
- Create: `docs/stabilization-report.md`
- Create: `docs/stabilization-checklist.md`

**Interfaces:**
- The report records evidence and priority classification.
- The checklist gives a future operator exact commands and expected outcomes.

- [ ] **Step 1: Write the verified baseline report**

Record the 2026-08-13 baseline:

```text
TypeScript: passed via npx tsc --noEmit
Lint: passed via npm run lint after isolated timeout diagnosis
Tests: 3 files / 10 tests passed via npm test -- --run
Production build: passed via npm run build
Git workflow: not verifiable in this environment because git is unavailable
Live integrations: not exercised because protected credentials are not available to the audit
```

Include a table of P0-P3 findings. Classify missing Resend production configuration and missing live integration verification as P1 release configuration blockers, the stale/fragmented documentation as P2, and the unavailable Git executable as an environment limitation rather than an application defect.

- [ ] **Step 2: Write the checklist**

Include these exact commands in order:

```powershell
npm ci
npm run typecheck
npm run lint
npm run test:ci
npm run build
```

Document the local smoke procedure: start the production build with `npm run start`, request `/`, confirm an HTTP success response, stop the process, and do not exercise authenticated/payment/document flows with real data.

- [ ] **Step 3: Add environment and authority safety notes**

State that `.env.local` is never printed or committed, production Academic Suite migrations belong in Lekta, and local SQL markers must not be applied as production DDL.

- [ ] **Step 4: Self-review the two documents**

Run:

```powershell
Select-String -Path docs/stabilization-report.md,docs/stabilization-checklist.md -Pattern 'TBD|TODO|PLACEHOLDER|sk_live_|whsec_' -CaseSensitive
```

Expected: no incomplete placeholder or secret pattern is present.

---

### Task 4: Align existing documentation with the audit

**Files:**
- Modify: `README.md`
- Modify: `PRELAUNCH.md`
- Modify: `docs/LOCAL_DEVELOPMENT.md`
- Modify: `docs/deployment/NETLIFY.md`
- Modify: `supabase/README.md`
- Verify unchanged behavior: `supabase/migrations/20260805010000_academic_suite_foundation_hardening.sql`

**Interfaces:**
- Existing documentation links to the new report/checklist.
- All documentation describes the same database authority and environment contract.

- [ ] **Step 1: Add canonical stabilization links**

Add links to `docs/stabilization-report.md` and `docs/stabilization-checklist.md` in the development/release sections of README and `docs/LOCAL_DEVELOPMENT.md`.

- [ ] **Step 2: Clarify the local migration marker**

In README and `supabase/README.md`, explicitly state that `supabase/migrations/20260805010000_academic_suite_foundation_hardening.sql` is a deprecated no-op history marker, is not production DDL, and must not be applied as the Academic Suite schema authority.

- [ ] **Step 3: Synchronize prelaunch configuration blockers**

Update the configuration section of `PRELAUNCH.md` to include `RESEND_API_KEY` and `WITHDRAWAL_FROM_EMAIL`, link the stabilization report, and retain the existing legal and cross-repository blockers. Do not mark external PRs, legal review, credentials, or production smoke as complete without evidence.

- [ ] **Step 4: Synchronize Netlify environment documentation**

Add the two Resend variables to the server-only environment list in `docs/deployment/NETLIFY.md`, including the verified sender requirement and the warning against `onboarding@resend.dev` in production.

- [ ] **Step 5: Review for contradictions**

Run:

```powershell
Select-String -Path README.md,PRELAUNCH.md,docs/**/*.md,supabase/README.md -Pattern 'separate Supabase|Katedra.*migration authority|production DDL|RESEND_API_KEY|WITHDRAWAL_FROM_EMAIL|stabilization' -CaseSensitive:$false
```

Expected: every match is consistent with Lekta being the production schema authority and the new environment contract.

---

### Task 5: Clean install, smoke check, and final verification

**Files:**
- Verify: `package.json`, `package-lock.json`, `.env.example`
- Verify: all files changed by Tasks 1-4

**Interfaces:**
- Produces the final evidence used by `docs/stabilization-report.md`.

- [ ] **Step 1: Run exact dependency installation**

Run:

```powershell
npm ci
```

Expected: exit code 0 with dependencies installed from `package-lock.json`.

- [ ] **Step 2: Run all code gates**

Run:

```powershell
npm run typecheck
npm run lint
npm run test:ci
npm run build
```

Expected: all four commands exit with code 0. Record actual test counts and build route output in the report.

- [ ] **Step 3: Run the production smoke check**

Start the server in a separate PowerShell process:

```powershell
$proc = Start-Process npm -ArgumentList 'run','start' -WorkingDirectory (Get-Location) -PassThru -WindowStyle Hidden
try {
  Start-Sleep -Seconds 5
  (Invoke-WebRequest http://localhost:3000/ -UseBasicParsing).StatusCode
} finally {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
```

Expected: HTTP status `200` for `/`. If the port is occupied or protected env values prevent startup, record the exact result instead of substituting a fake integration test.

- [ ] **Step 4: Re-run repository safety scans**

Run:

```powershell
Select-String -Path .env.example,README.md,PRELAUNCH.md,docs/**/*.md,supabase/**/*.sql -Pattern 'sk_live_|whsec_|service_role' -SimpleMatch
```

Expected: no live secret value is present. Confirm the SQL marker still contains only comments and no executable DDL.

- [ ] **Step 5: Update the report with final evidence**

Replace provisional baseline wording with the final command results, list any remaining P1 blockers, and explicitly state which live/external checks remain unverified.

- [ ] **Step 6: Inspect the final diff**

Run:

```powershell
git diff --check
git diff --stat
```

Expected: no whitespace errors and only the planned documentation/configuration files changed. If Git remains unavailable, perform a file list review and report the limitation.
