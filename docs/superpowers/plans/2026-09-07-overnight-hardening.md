# Overnight hardening implementation plan

> **For agentic workers:** Use `superpowers:executing-plans` sequentially. Independent reviewers may inspect code and tests without changing files.

**Goal:** Reduce evidence-backed security, privacy, billing and data-loss risks on current master, with reproducible local checks and an honest release handoff.

**Architecture:** Preserve canonical Lekta contracts and local-first manuscript content. Make small changes at existing boundaries; extract typed pure decisions where they reduce risk. Keep deployment evidence separate from local fixtures.

**Tech stack:** Next.js App Router, TypeScript/JavaScript, Vitest, Playwright, existing Supabase and Stripe clients.

**Spec:** Owner's `KATEDRA — OVERNIGHT MASTER GOAL`, supplied on 2026-09-07 (36 numbered sections). The owner approved proceeding in this conversation. This engineering approval does not constitute an application run's `planApproved` event.

## Constraints and starting point

- Lekta alone owns deterministic DOCX compliance and production database migrations.
- Preserve authentication, project ownership, entitlement, billing, rate limiting and project locks.
- Do not enable production, agentic or material flags, copy secrets, or send manuscript content through shared state/logs.
- Preserve legacy compatibility until callers and canonical replacement are proved.
- Main checkout `codex/autonomous-v1-continue` contains pre-existing work. Leave it untouched.
- Isolated branch: `codex/overnight-katedra-hardening`, based on `origin/master` at `24dfc1841f475ba31791c017d23267deaee796ff`.
- PR #36 is parallel work, not part of this baseline. Coordinate overlapping worker/context changes in the handoff; do not silently incorporate it.

## Execution and coverage

Each implementation slice follows: inspect actual caller and contract; reproduce failure; minimum fix; focused and related tests; review diff; semantic commit. A confirmed external dependency or undecided privacy authority gets a concrete brief, not a simulated PASS.

- [x] Sections 0–1: inspect rules, freeze Git state, fetch master, create isolated branch.
- [x] Section 2: finish baseline and record versions, counts, skips and browser checks in `docs/release/LOCAL_VERIFICATION_2026-09-07.md`.
- [x] Sections 3, 26: reconcile PRs #19/#21/#36 and issues #23–#32 against current code; record classifications and remaining proof.
- [x] Section 4: write `docs/architecture/CURRENT_ARCHITECTURE.md` with authority, persistence, compatibility and activation matrix.
- [ ] Sections 5–6: audit DOCX content extraction and temporary Storage; test bounded extraction and revoked/expired context; document constitutional privacy options and canonical cleanup/replacement dependencies.
- [x] Sections 7–8, 17: complete mutation HTTP matrix; reproduce cost reservation, withdrawal confirmation and duplicate-refund failures; preserve replay and ownership checks. Exact purchase replay and effectful balance reads are documented too; remote guarantees remain external.
- [x] Section 9: inspect run lease/claim/cancel/resume/retry/budget/provenance invariants with existing runtime tests; distinguish local contracts from deployed RPC proof. Evidence matrix is in `HTTP_AUTHORITY_MATRIX_2026-09-08.md`.
- [ ] Section 10: extract a typed chat decision only where a reproduced bug justifies it, preserving HTTP and streaming contracts.
- [x] Section 11: extract pure state privacy projections from route orchestration; retain legacy writes and project ownership lookups. Typed finding projection extracted; other legacy allowlists remain explicit, not fully refactored.
- [x] Section 12: reproduce hydration/proposal races with deferred responses; protect edits and extract bounded proposal lifecycle from workspace orchestration. Destroyed-editor transition and real Tiptap/browser checks also covered.
- [x] Section 13: introduce scoped `typecheck:strict` for changed pure domains; do not enable global strictness.
- [x] Section 14: provide an offline deterministic canonical database projection check, requiring a supplied authoritative generated source. No fresh canonical source was supplied; remote parity remains unverified.
- [x] Section 15: reconcile typed server configuration and preflight requirements without enabling flags.
- [x] Section 16: inspect log call sites and preserve only bounded identifiers, error codes and operational outcomes. Duplicate-refund and legacy starter raw error logs now use the existing projection.
- [ ] Sections 18–20: map Pass promises to real capabilities; correct inaccurate copy; audit local AI provenance and policy verification without inventing facts or cross-device storage. Local ledger/export and evidence/date/scope guards complete; final promise matrix and owner freshness choices remain to document.
- [ ] Sections 21–22: verify touched UI accessibility and responsiveness; change performance behavior only with measured evidence.
- [ ] Sections 23–24: classify test evidence and remove misleading integration claims; consolidate browser helpers only if there is useful, proven duplication.
- [ ] Section 25: publish current status and preserve historical release evidence.
- [ ] Sections 27–30: prioritize P0/P1, avoid new subsystems, review and commit small independent changes.
- [ ] Sections 31–32: final dependency audit, typecheck, strict check, lint, tests, build, browser checks, diff and security/privacy/billing/compatibility review.
- [ ] Sections 33–36: write `docs/release/OVERNIGHT_HARDENING_2026-09-07.md`, audit completion against this checklist, and provide the requested terminal handoff.

## First implementation slice: bounded request reservations

**Inspect:** `app/api/chat/route.js`, `lib/ai/cost-policy.ts`, `lib/ai/rate-limit.js`, existing route runtime and billing tests.

**Observed risk:** The route reserves an estimate for 512 output tokens before later allowing up to 8192. The canonical daily ceiling receives a smaller amount than the provider's permitted output. A passing local test must compare the reserved estimate with the actual outgoing provider limit, not merely assert that a reservation was called.

- [x] Add a runtime regression using a token-sensitive cost estimate, an affordable output limit greater than 512, and a captured provider request. Assert reserved charge covers permitted output.
- [x] Run the test and record its expected assertion failure: 2561 reserved versus 5121 / 40961 required by allowed output.
- [x] Bound reservation conservatively before side effects. Preserve release on every acquired-reservation exit and unknown-usage reconciliation.
- [x] Assert successful stream responses use private/no-store caching, with no response-body contract change. Separately observed the previous `no-cache` assertion failure.
- [x] Run chat runtime, cost-policy, rate-limit and billing tests; review affected exits; commit `de278b9`.

## Additional reproduced-failure candidates

These are audit findings to reproduce before implementation, not completed fixes:

| Boundary | Regression to establish | Intended invariant |
| --- | --- | --- |
| Withdrawal | Email API resolves with an error; confirmation database update fails | Receipt remains durable; API never claims an unconfirmed delivery |
| Duplicate refund | Refund has an ID but status is failed/canceled/pending | HTTP/logging distinguish confirmed refund from reconciliation |
| Material extraction | Text exceeds 250000 characters and a truncation suffix is added | A successful partial extraction remains consumable by the context loader |
| Image material | Declared MIME disagrees with extension/signature | Unsupported or inconsistent bytes cannot reach OCR/storage as a valid image |
| Run context | Bytes still exist after expiry or tombstone | Canonical revocation and expiry prevent provider access |
| Workspace hydration | User edits while metadata request is pending | Late metadata cannot overwrite current manuscript content |
| Proposal acceptance | User edits/navigates while snapshot is pending | Stale proposal cannot replace new content |
| Pass dialog | Reopen for a different project after checking consent | Consent cannot transfer to a different purchase context |
| Preflight | Material flag or deletion contract missing | Environment checker cannot report available while UI capability rejects it |

## External evidence and owner decisions

- Canonical RPC/RLS atomicity, authenticated money flow, cleanup scheduling and real provider/verifier staging need their actual environments.
- Current constitution's DOCX/server-content language conflicts with existing content extraction and temporary private Storage. Document two or three concrete authority choices; do not treat this general plan approval as approval to change privacy/commercial authority.
- Preserve the owner's prior choice of zero mandatory approving reviewers on master. Do not restore an obsolete issue's review requirement.
