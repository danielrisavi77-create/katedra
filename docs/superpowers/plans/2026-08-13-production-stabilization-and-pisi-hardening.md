# Production Stabilization and `/pisi` Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Katedra safe and observable enough for a staging money-flow, remove confirmed runtime blockers, and make the `/pisi` writing workflow reliable under refreshes, retries, bad backups, and AI proposal changes.

**Architecture:** Keep Lekta as the sole database migration authority. Katedra will expose small, testable server helpers for catalog validation, billing state decisions, project ownership, and manuscript proposal application. Database-dependent billing reservation/settlement remains behind a documented RPC contract and is not emulated with a second local schema. Local manuscript content remains IndexedDB-only.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase SSR, Stripe, Anthropic SSE, Tiptap 3, IndexedDB, Vitest, TypeScript, Playwright in CI.

## Current execution status — 2026-08-13

- Tasks 1–5 are implemented and locally verified.
- Task 6 local route/runtime coverage, CI gates, preflight and the staging
  runbook are implemented.
- Withdrawal now uses a durable Lekta reservation/commit/release adapter in
  production, with stable client request IDs and a local fallback only for
  development/tests.
- Chat cost ceilings now cover both text payloads and attachment payloads
  before provider streaming.
- The four staging integration tests remain intentionally skipped until a
  `KATEDRA_INTEGRATION_URL` and dedicated staging credentials are supplied.
- Lekta RPC deployment, production configuration and authenticated money-flow
  evidence remain external release blockers.

## Global Constraints

- Never expose service-role, Anthropic, Stripe, or Resend secrets to browser code.
- Never store manuscript body text, raw DOCX, source passages, or mentor comments in `/api/state` or shared backend state.
- Every authenticated project operation must resolve ownership server-side.
- Every AI charge must have one idempotent billing outcome or an explicit reconciliation state.
- Every AI proposal must be applied only against the document revision and selection it was created for.
- Lekta remains the only authority for production SQL migrations and DOCX compliance verification.
- No new dependency is added unless the existing package set cannot provide the required behavior.

---

### Task 1: Repair checkout runtime and align Project Pass lookup

**Files:**
- Modify: `app/api/checkout/route.js`
- Modify: `app/api/balance/route.js`
- Test: `app/api/checkout/route.test.js`
- Test: `app/api/balance/route.test.js`
- Test: `lib/academic-suite/repositories/entitlements.test.ts`

**Interfaces:**
- `checkout` consumes `KATEDRA_PACKAGES` and the owned canonical project lookup.
- `checkout` produces a Stripe URL only after validating the canonical UUID, work type, and matching Katedra Pass absence.
- `balance` consumes the same typed entitlement repository and the same canonical project ID used by chat.

- [ ] **Step 1: Write failing runtime-oriented checkout tests**

Test the pure catalog/project validation helper with:

```js
expect(validateCheckoutProject({ projectId: validUuid, workTypeCanonical: 'graduate' }, 'diplomski')).toEqual({ ok: true })
expect(validateCheckoutProject({ projectId: 'klegacy', workTypeCanonical: 'graduate' }, 'diplomski').status).toBe(409)
expect(validateCheckoutProject({ projectId: validUuid, workTypeCanonical: 'seminar' }, 'diplomski').status).toBe(400)
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm.cmd test -- app/api/checkout/route.test.js`

Expected: FAIL because the validation helper and checkout UUID contract do not exist.

- [ ] **Step 3: Add a shared UUID/catalog validation helper and define `UUID_RE` once**

Create `lib/stripe/checkout-validation.js` with the exact return shape `{ ok: true }` or `{ ok: false, status, error }`. Import it in checkout and remove the undefined runtime reference. The helper must reject missing project IDs, non-UUID canonical IDs, and mismatched canonical work types.

- [ ] **Step 4: Make existing-entitlement detection match `hasActiveProjectPass`**

The checkout duplicate check must use `provider='stripe'`, `product_id IS NULL`, `status='active'`, the same `academic_project_id`, and a non-expired `purchase_expires_at`, or call a repository helper that returns the same semantic result.

- [ ] **Step 5: Run focused tests and then all tests**

Run: `npm.cmd test -- app/api/checkout/route.test.js app/api/balance/route.test.js lib/academic-suite/repositories/entitlements.test.ts`

Expected: PASS.

---

### Task 2: Define billing settlement and reconciliation boundaries

**Files:**
- Create: `lib/ai/billing-contract.ts`
- Create: `lib/ai/billing-state.test.ts`
- Modify: `app/api/chat/route.js`
- Modify: `app/api/chat/route-contract.test.js`
- Create: `docs/architecture/KATEDRA_BILLING_RPC_CONTRACT.md`

**Interfaces:**
- `BillingAttemptState = 'reserved' | 'settled' | 'released' | 'pending_reconciliation'`.
- `BillingAttemptInput = { requestId, userId, projectId, model, inputTokens, outputTokens, charged }`.
- `resolveBillingFailure(input)` returns whether to retry, release, or reconcile without charging twice.

- [ ] **Step 1: Write failing billing state tests**

Cover successful settlement, missing usage, provider failure before usage, RPC timeout, duplicate finalizer invocation, and already-settled request IDs.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm.cmd test -- lib/ai/billing-state.test.ts`

Expected: FAIL because the contract module does not exist.

- [ ] **Step 3: Implement the pure billing state contract**

The helper must make the decision explicit and must never treat unknown usage as a successful zero-cost request.

- [ ] **Step 4: Update chat finalization to pass request identity**

Pass `p_request_id`, `p_project_id`, and the observed token usage to the canonical RPC contract. Keep the in-process promise guard, but treat it only as an optimization. If the RPC is unavailable or returns an unknown outcome, log `pending_reconciliation` and return a controlled stream error rather than silently swallowing it.

- [ ] **Step 5: Document the Lekta-side RPC requirement**

Document required idempotency behavior: same `(user_id, request_id)` must return the same result; a second settlement must not debit again; a release must not debit; unknown/timeout outcomes must remain reconcilable.

- [ ] **Step 6: Run focused chat/billing tests**

Run: `npm.cmd test -- lib/ai/billing-state.test.ts lib/ai/anthropic-sse.test.js app/api/chat/route-contract.test.js`

Expected: PASS.

---

### Task 3: Add distributed-limit seam and cost ceilings

**Files:**
- Modify: `lib/ai/rate-limit.js`
- Modify: `lib/ai/rate-limit.test.js`
- Create: `lib/ai/cost-policy.ts`
- Create: `lib/ai/cost-policy.test.ts`
- Modify: `app/api/chat/route.js`
- Modify: `app/api/chat/route-contract.test.js`
- Create: `docs/architecture/KATEDRA_RATE_LIMIT_CONTRACT.md`

**Interfaces:**
- `reserveUserRequest(userId, now)` remains available for local tests and development.
- `validateCostCeiling({ balance, minimumBalance, estimatedCharge })` rejects requests that cannot safely fit the configured ceiling.
- `RateLimitStore` documents the production atomic implementation required in Lekta/Supabase or an approved distributed store.

- [ ] **Step 1: Write failing cost-policy tests**

Test per-request input ceiling, minimum remaining balance, daily user ceiling, and active-stream limit.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm.cmd test -- lib/ai/cost-policy.test.ts`

Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement pure cost-policy validation**

Use bounded constants and return structured reasons for `request_too_large`, `daily_ceiling`, `insufficient_balance`, and `concurrency`.

- [ ] **Step 4: Add production store seam**

Keep the current in-memory store only as a development fallback. Add a server-only interface and fail closed in production if no distributed implementation is configured. Do not pretend the process-local `Map` is production-safe.

- [ ] **Step 5: Add atomic reservation contract documentation**

Specify required database behavior and the 9-parallel-request test that must run in staging.

- [ ] **Step 6: Run rate/cost/chat tests**

Run: `npm.cmd test -- lib/ai/rate-limit.test.js lib/ai/cost-policy.test.ts app/api/chat/route-contract.test.js`

Expected: PASS.

---

### Task 4: Harden manuscript proposal application and backups

**Files:**
- Modify: `lib/manuscript/proposals.ts`
- Modify: `lib/manuscript/proposals.test.ts`
- Modify: `app/pisi/components/workspace-client.tsx`
- Modify: `app/pisi/components/manuscript-editor.tsx`
- Create: `lib/manuscript/backup-validation.ts`
- Create: `lib/manuscript/backup-validation.test.ts`

**Interfaces:**
- `AiProposalV1` stores the original selection range and base revision.
- `validateManuscriptBackup(value, projectId)` returns a normalized manuscript or a structured validation error.

- [ ] **Step 1: Write failing proposal tests**

Verify that accepting a proposal uses its original selection, rejects a changed document revision, and never falls back from a missing selection to replacing the entire document.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm.cmd test -- lib/manuscript/proposals.test.ts`

Expected: FAIL because selection ownership is currently held only in transient component state.

- [ ] **Step 3: Persist original selection in the proposal**

Create the proposal with `selectedFrom` and `selectedTo`, and use those values when building `applyRequest`. If the proposal was selection-based and the range is unavailable, mark it stale instead of replacing the document.

- [ ] **Step 4: Write failing backup validation tests**

Cover valid backup, wrong project, oversized JSON, malformed section, invalid status, malformed content, and excess sections/sources.

- [ ] **Step 5: Implement bounded deep validation**

Validate schema version, project identity, section IDs/titles/kinds/statuses/orders, Tiptap node depth/size, source sizes, and metadata lengths. Return a safe normalized object.

- [ ] **Step 6: Wire restore through the validator and snapshot before restore**

Do not replace active state with an unvalidated object. Save a pre-restore snapshot and show a user-facing error.

- [ ] **Step 7: Run editor/manuscript tests**

Run: `npm.cmd test -- lib/manuscript/proposals.test.ts lib/manuscript/backup-validation.test.ts lib/manuscript/storage.test.ts`

Expected: PASS.

---

### Task 5: Make project sync honest and observable

**Files:**
- Create: `lib/manuscript/sync-status.ts`
- Create: `lib/manuscript/sync-status.test.ts`
- Modify: `app/pisi/components/workspace-client.tsx`
- Modify: `app/pisi/components/workspace-shell.tsx`
- Modify: `app/privatnost/page.jsx`
- Modify: `app/api/state/route.js`
- Modify: `app/api/state/route.test.js`

**Interfaces:**
- `SyncStatus = 'local_only' | 'syncing' | 'synced' | 'failed'`.
- `syncMetadata()` returns `{ status, responseStatus }` and never silently treats a non-2xx response as success.

- [ ] **Step 1: Write failing sync-status tests**

Cover successful sync, HTTP failure, network failure, anonymous local-only use, and project mismatch.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm.cmd test -- lib/manuscript/sync-status.test.ts`

Expected: FAIL because current sync swallows all outcomes.

- [ ] **Step 3: Implement the sync status helper**

Return structured outcomes and preserve local manuscript usability on server failure.

- [ ] **Step 4: Surface sync state in `/pisi`**

Add a compact status to the shell: local-only, syncing, synced metadata, or sync failed. Do not claim the manuscript is synced because only metadata is stored server-side.

- [ ] **Step 5: Align privacy copy**

Explicitly state that the manuscript body remains device-local and only project metadata/process state is synced. Do not promise cross-device manuscript continuation until a real restore flow exists.

- [ ] **Step 6: Run sync/state tests**

Run: `npm.cmd test -- lib/manuscript/sync-status.test.ts app/api/state/route.test.js`

Expected: PASS.

---

### Task 6: Add integration coverage and release gates

**Files:**
- Create: `app/api/checkout/route.integration.test.js`
- Create: `app/api/chat/route.integration.test.js`
- Create: `app/api/webhook/route.integration.test.js`
- Create: `app/api/state/route.integration.test.js`
- Modify: `.github/workflows/academic-suite-browser-e2e.yml`
- Modify: `docs/stabilization-checklist.md`
- Create: `docs/release/STAGING_MONEY_FLOW.md`

**Interfaces:**
- Integration tests use injected/mocked clients at the route boundary and verify HTTP status, ownership, provider failures, and idempotency behavior.
- Browser E2E remains external-credential-only and is never reported as passed without staging credentials.

- [ ] **Step 1: Write failing checkout, webhook, chat, and state integration tests**

Cover checkout runtime, duplicate webhook, wrong amount/currency, project ownership, active/expired Pass, chat 402/403/429, billing failure, exact state project read, and manuscript exclusion.

- [ ] **Step 2: Run focused integration tests and confirm missing behavior**

Run: `npm.cmd test -- app/api/checkout/route.integration.test.js app/api/webhook/route.integration.test.js app/api/chat/route.integration.test.js app/api/state/route.integration.test.js`

Expected: failures identify the remaining route seams instead of only source text mismatches.

- [ ] **Step 3: Implement the minimum dependency injection needed for deterministic route tests**

Keep production imports unchanged at the public route boundary; inject database/Stripe/provider adapters through small server helpers rather than mocking implementation internals.

- [ ] **Step 4: Add a staging money-flow runbook**

Record required environment keys, test account setup, expected database outcomes, duplicate webhook behavior, stream interruption behavior, and cleanup requirements.

- [ ] **Step 5: Make authenticated browser E2E an explicit release gate**

Separate guest handoff/DOCX E2E from authenticated money-flow E2E. The workflow must fail clearly when staging credentials are absent rather than silently proving only the guest flow.

- [ ] **Step 6: Run all local gates**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

Expected: all pass, with external staging evidence listed separately.

---

## External blockers that cannot be completed in this repository alone

1. Lekta-side migration/RPC implementation for idempotent billing reservation and reconciliation.
2. Production/staging Supabase, Stripe, Anthropic, and Resend credentials.
3. Verified production Resend sender.
4. Legal review and replacement of all legal page placeholders.
5. Staging run of the authenticated checkout → webhook → chat flow.

These are release prerequisites, not reasons to weaken local behavior or pretend local tests prove production integration.
