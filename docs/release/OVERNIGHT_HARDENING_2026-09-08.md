# KATEDRA OVERNIGHT — PARTIAL

Local hardening is verified and ready for review. Full product integration and
production/service activation are not established. Keep this branch's PR draft
until the affected authority, compatibility and release decisions below are
reviewed. Engineering plan approval is not a run's `planApproved` event.

## Starting point

- Base: `origin/master`, `24dfc1841f475ba31791c017d23267deaee796ff`.
- Branch: `codex/overnight-katedra-hardening`; isolated worktree under
  `.worktrees/overnight-hardening`.
- Original checkout: `codex/autonomous-v1-continue`. Its 164 status entries
  matched the captured initial status at final verification; no user work was
  reset, stashed, copied or removed by this branch.
- Master was fetched again on September 8 and still matched the base.
- Baseline: Node 24.14.0, npm 11.9.0; 876 tests passed, 4 skipped;
  typecheck, lint, production build and three guest browser scripts passed.
  CI uses Node 22; local success does not substitute for its results.

## Findings and implemented changes

Severity below describes the risk of the reproduced local failure, not evidence
of a production incident. No P0 production or distributed guarantee is claimed
closed. Twelve P1 groups were addressed locally; remaining limits are explicit.

| Priority / root cause | Files carrying the fix | Behavior and regression evidence |
| --- | --- | --- |
| P1: chat reserved only 512 output tokens while permitting up to 8192 | `app/api/chat/route.js` | Reserve the maximum permitted estimate before wallet/starter side effects. Runtime regressions captured 2561 reserved versus permitted estimates 5121/40961. SSE now uses private/no-store. Conservative reservation can reject near-ceiling requests whose eventual output would cost less. |
| P1: worker could read context without fresh canonical access checks | `lib/agents/run-context-access.ts`, `run-context-loader.ts`, worker route | Require exactly one active, scoped manifest and bounded matching private descriptor, with valid future expirations, before manuscript access. 22 access cases plus route wiring/query tests. In-flight revocation and physical deletion are not atomic guarantees. |
| P1: refund ID alone was treated as successful refund | `lib/stripe/duplicate-refund.js` | Require `succeeded`; refresh the same pending/action refund ID and verify identity. Failed/unknown results require reconciliation. Runtime status/retry tests; durable reconciliation beyond provider idempotency retention remains canonical work. |
| P1: unique entitlement conflict could replay a wallet grant without purchase identity proof | `lib/stripe/entitlement-replay.ts`, webhook route | Match canonical user, project, provider, order, product, work type and nonempty entitlement ID before replay. Ten runtime mismatch/error cases. A mocked lookup does not prove deployed uniqueness/atomicity. |
| P1: withdrawal confirmation ignored resolved email and persistence errors | withdrawal route | Preserve the durable receipt, require email provider acceptance, report reconciliation when confirmation/reservation persistence fails. Three red regressions; 16 related tests passed. Acceptance is not inbox delivery. |
| P1: asynchronous hydration/proposal work could overwrite newer edits | workspace, manuscript editor, manuscript state, proposal application/hydration/expiry modules | Check current identity/revision/content after awaits; normalized Tiptap document comparison; reject stale proposals; prevent duplicate application and old expiry timers; guard destroyed editors. Deferred race tests and actual Tiptap/browser regressions. |
| P1: purchase consent and late checkout could leak across purchase contexts | Pass dialog, legal summary modal | Remount by visible purchase identity, reset consents, abort obsolete requests and ignore aborted responses. Restore nested modal focus and contain Escape/Tab. Component regressions and real Chromium interaction passed. |
| P1: incomplete or inapplicable policy evidence could unlock generation | `lib/academic-suite/process-facts.ts` | Require verified source title/HTTP URL, valid non-future dates and applicable scope. Program/course facts cannot grant unit-wide permission without identity. Eighteen policy cases. Old valid dates are not a freshness guarantee; first invalid/narrow match blocks conservatively. |
| P1: ZIP metadata could understate actual expanded output | `lib/docx/zip-resource-check.ts`, `validation.js` | Bound actual stored/deflated output and directory/header ranges using existing budgets; reject ambiguity, hidden streams and contradictory Unicode names. Forged-size/stream/name regressions and real Packer-to-Mammoth extraction passed (35 related tests). This is resource safety, not Word compliance; hard CPU termination remains open. |
| P1: truncated material exceeded the consumer limit; image identity was inconsistent | `lib/materials/extractors.ts` | Include the truncation marker inside the 250000-character budget and require supported extension/MIME agreement before OCR. Eight reproduced cases; 42 related tests passed. |
| P1: auth callback could reflect unbounded provider error text and cache redirects | auth callback route | Fixed bounded error code, private/no-store redirects and caught exchange/configuration failures. Five callback tests passed. No real login exchange is claimed. |
| P1: raw provider/database errors could reach operational logs | duplicate refund and free starter modules | Use the existing bounded operational projection; synthetic private SQL-detail regression confirms exclusion. No new manuscript/prompt/output logging. |
| P2: ordinary AI actions lacked a bounded truthful local history/export | `lib/manuscript/ai-ledger.ts`, workspace, project drawer | Local project-scoped versioned metadata records request outcome and actual user decision; excludes prompt/output, caps 200 rows, exposes storage failure and exports through actual UI. Seven ledger tests include a transient write failure found in review. Cross-tab writes can race; this is not immutable, synced or billing authority. |
| P2: configuration/type/evidence drift | scoped strict config, state issue projection, database projection script, preflight, fixture script | Strict checks cover selected changed boundaries; state finding projection remains metadata-only; canonical type checker requires an explicitly supplied generated source; preflight aligns required material/delete/provider settings. Canned worker responses explicitly print fixture-only evidence. |
| P2: marketing implied unsupported analysis or universal policy coverage | landing, Pass dialog, README, promise matrix | Describe research planning/content revisions and available verified institutional rules. Prices, purchase windows and entitlements are unchanged. No capability was enabled to support a promise. |

The full changed-file inventory and semantic commits are appended below. No
changes were made to `supabase/`, agent `contracts.ts`, `verifier.ts` or
`worker.ts`, the doctrine text, production DDL, `AgentResultV1`, provider output
parsing or the Lekta handoff/compliance contract. No dependencies were added.

## Verification

Final implementation checkpoint: `f411cca`. Later changes are release-report
documentation. Logs are outside the worktree in the operating-system temporary
directory, prefixed `katedra-overnight-final-`; they are local execution evidence,
not uploaded staging credentials or a signed release evidence bundle.

| Command | Exit | Final result |
| --- | --- | --- |
| `npm run typecheck` | 0 | TypeScript check passed |
| `npm run typecheck:strict` | 0 | Scoped strict check passed |
| `npm run lint` | 0 | No errors or warnings |
| `npm run test:ci` | 0 | **212 files passed, 4 skipped; 1033 tests passed, 4 skipped; 74.17 s** |
| `npm run build` | 0 | Production build completed; static/dynamic routes generated |
| `node scripts/pisi-workspace-ui-e2e.mjs` | 0 | `PISI_WORKSPACE_BROWSER_E2E_PASS` |
| `node scripts/hybrid-mentor-ui-e2e.mjs` | 0 | `HYBRID_MENTOR_UI_BROWSER_E2E_PASS`; authenticated journey explicitly `BLOCKED_EXTERNAL` |
| `node scripts/agent-studio-ui-smoke.mjs` | 0 | `AGENT_STUDIO_UI_SMOKE_PASS` |
| `npm run audit:dependencies` | 0 | 28 moderate advisories; no high/critical advisories; no force-fix |
| `gitleaks git . --log-opts=24dfc18..HEAD --redact --no-banner` | 0 | No leaks found in 20 implementation commits; documentation is checked again before push |
| `git diff --check` | 0 | No whitespace errors |
| `npm run preflight:production` | 1 | Required deployment configuration absent |
| `npm run preflight:agentic` | 1 | Required worker/material/provider/verifier configuration absent |
| `npm run preflight:release` | 1 | Configuration and canonical/authenticated/evidence bundle absent; fails closed |

Browser scripts used the actual production build on `http://127.0.0.1:3020`.
The workspace export check uses synthetic local metadata. Earlier actual Tiptap
and purchase component QA reported `REAL_TIPTAP_AND_PURCHASE_COMPONENT_BROWSER_PASS`.
Neither is proof of authenticated payment/provider/RPC execution. The existing
Vite CommonJS/ESM configuration warning remains non-fatal. Four integration
skips are retained, not relabeled as passes.

GitHub results belong to the PR's exact head and must be inspected separately.
Required checks remain `check`, `browser-e2e`, `gitleaks`. A green PR workflow
also does not imply the manual authenticated release gate ran.

## Metrics and scope limits

- Passing tests: **876 → 1033 (+157)**; skipped tests: **4 → 4**.
- Passing files: **200 → 212 (+12)**; no baseline failure was hidden.
- Scoped strictness is now executable in local and foundation CI checks; global
  strictness was not enabled. No unsupported all-repository type-safety claim.
- State route sheds its inline finding projection; proposal/hydration decisions
  are extracted. Chat and workspace are still large orchestrators. A full rewrite,
  CSS cleanup and browser-helper consolidation were deliberately not attempted.
- No comparable performance benchmark was run; browser responsiveness checks
  establish their assertions only. No numerical speedup or complexity claim.

## Still blocked externally / canonical authority

1. Canonical Lekta RPC/RLS deployment and authenticated ownership, lease,
   cancellation, retry, concurrency and project-lock proof.
2. Actual Stripe checkout/webhook/grant/consume/refund reconciliation and durable
   withdrawal/email proof. Local mocks do not prove distributed transactions.
3. Account deletion remains unavailable until canonical authority exists.
   Tombstoned failed deletes, unregistered upload orphans and context replacement
   require recoverable canonical cleanup/versioning. TTL access denial is not
   erasure; changing client operation order alone cannot make replacement atomic.
4. Real provider plus independent verifier staging, canonical generated database
   source, verified institutional pilot facts (current pack has zero entries),
   and commit-bound release evidence are absent.
5. Katedra pack freshness must be checked against Lekta
   `dist-packs/katedra-pack.json`; refresh `public/katedra-pack.json` in a separate
   PR if stale. This branch does not invent or certify those facts.

Open local work is **not** disguised as external: extraction still needs hard
worker/process termination with deployment packaging/resource proof. Bounded
output does not cancel CPU work; Mammoth/PDF/OCR timeouts need separate treatment.
Local ledger atomicity across tabs is also not guaranteed.

## Owner decisions

- Resolve the constitution versus existing temporary server-content behavior:
  fully local/Lekta-only input and worker redesign; transient semantic extraction
  without persistence; or explicit bounded private TTL storage with consent and
  a deletion contract. General engineering approval settles none of these.
- Choose policy freshness responsibility (common maximum age, reviewed
  per-source validity dates, or generation blocked until a reviewed pilot) and
  canonical program/course applicability identity.
- Limit paid/premium launch to authenticated, evidenced workflows, or keep the
  affected offering unavailable until its promises are proved.
- Zero mandatory approving reviewers on master was already the owner's choice;
  no new reviewer requirement was added. Required CI and other protections stay.

See [current architecture](../architecture/CURRENT_ARCHITECTURE.md),
[HTTP authority matrix](HTTP_AUTHORITY_MATRIX_2026-09-08.md) and
[Pass promise matrix](PASS_PROMISE_MATRIX_2026-09-08.md) for concrete options.

## Open PR reconciliation (September 8 readback)

| PR | State / head | Classification and next action |
| --- | --- | --- |
| [Katedra #19](https://github.com/danielrisavi77-create/katedra/pull/19) | OPEN, MERGEABLE, `b668d94` | PARTIALLY_SUPERSEDED roadmap; review against current implementation, not an implementation fix |
| [Katedra #21](https://github.com/danielrisavi77-create/katedra/pull/21) | OPEN, CONFLICTING, `cd8f736` | REQUIRES_REBASE and OWNER_DECISION; preserve state privacy/ownership and obtain canonical authority |
| [Katedra #36](https://github.com/danielrisavi77-create/katedra/pull/36) | OPEN, MERGEABLE, `fd5b108` | CURRENT_AND_RELEVANT parallel work; preserve revision-bound explicit approval and this branch's active-context checks together |
| [katedra-pkg #48](https://github.com/danielrisavi77-create/katedra-pkg/pull/48) | Parallel explicit-plan-approval service work, `8ce1f924` previously checked | Local service/application checks are evidence of that scope only; service is not activated |

Issues #23–#32 remain open as classified in
[CURRENT_STATUS.md](CURRENT_STATUS.md). No other PR was merged or silently
cherry-picked. Full integration between the service repository and the app is
**not** claimed: canonical deployment and the authenticated end-to-end journey
remain required.

## Merge and next five actions

**MERGE-READY: NO.** Keep the PR draft while reviewing the affected privacy and
upload compatibility boundaries and PR #36 overlap. Passing local and GitHub
checks alone cannot authorize service activation or close canonical blockers.

1. Review this hardening diff and exact-head CI; resolve the temporary-content
   authority decision and upload compatibility/CPU-isolation release conditions.
2. Implement canonical deletion, recoverable cleanup/context replacement and
   durable billing reconciliation in Lekta; supply generated contract evidence.
3. Reconcile Katedra #36 with active-context checks and katedra-pkg #48; prove
   revision-bound user approval through the real app/service boundary.
4. Supply reviewed institutional policy facts/freshness/applicability and prove
   the promised paid workflows in authenticated staging.
5. Run the commit-bound canonical, money-flow, provider/verifier and release
   gates; only then make a separate merge/activation decision.

## Implementation commits

- `de278b9` fix(chat): reserve full output budget and prevent stream caching
- `848e324` fix(withdrawal): report failed confirmation without losing receipt
- `e9fcfb9` fix(materials): enforce extraction bounds and image MIME identity
- `87b38f3` fix(agents): require active scoped context before manuscript access
- `c31db71` fix(config): align agentic preflight and add scoped strict typecheck
- `5cf1b4e` fix(billing): confirm duplicate refunds only after successful status
- `4c3cdcd` fix(workspace): preserve edits across asynchronous proposal and hydration changes
- `e19bd12` fix(purchase): scope consent to the visible project and restore modal focus
- `a9b8b01` fix(auth): keep callback redirects private and bound provider errors
- `d35598b` fix(billing): verify purchase identity before replaying wallet grant
- `87f7792` fix(policy): require verified applicable evidence before capability unlock
- `0f4380d` refactor(state): isolate typed privacy projection of Lekta findings
- `9c8bd41` chore(types): include manuscript boundaries in strict checks
- `4a4bb1d` chore(contracts): check consumed database types against a supplied canonical export
- `6a579d1` test(agents): distinguish response fixtures from worker integration evidence
- `5c92445` feat(provenance): record bounded local AI outcomes and user decisions
- `1edc9bd` fix(privacy): sanitize legacy starter grant errors
- `207e085` docs(hardening): record HTTP authority and verified local checkpoints
- `197ab4d` fix(uploads): bound actual ZIP expansion before semantic extraction
- `f411cca` docs(product): align Pass promises with available workflow evidence

Final documentation is committed separately after these verified implementation commits.

## Changed files against the base

- `.github/workflows/foundation-check.yml`
- `app/api/chat/route.js`
- `app/api/chat/route.runtime.test.js`
- `app/api/internal/agent-worker/route.js`
- `app/api/internal/agent-worker/route.runtime.test.js`
- `app/api/internal/agent-worker-route.test.js`
- `app/api/state/route.js`
- `app/api/webhook/route.js`
- `app/api/webhook/route.runtime.test.js`
- `app/api/withdrawal/route.js`
- `app/api/withdrawal/route.runtime.test.js`
- `app/auth/callback/route.js`
- `app/auth/callback/route.test.js`
- `app/legal-summary-modal.jsx`
- `app/page.jsx`
- `app/pisi/components/manuscript-editor.runtime.test.tsx`
- `app/pisi/components/manuscript-editor.tsx`
- `app/pisi/components/pass-dialog.test.tsx`
- `app/pisi/components/pass-dialog.tsx`
- `app/pisi/components/project-drawer.test.tsx`
- `app/pisi/components/project-drawer.tsx`
- `app/pisi/components/use-manuscript-state.test.tsx`
- `app/pisi/components/use-manuscript-state.ts`
- `app/pisi/components/use-proposal-expiry.test.tsx`
- `app/pisi/components/use-proposal-expiry.ts`
- `app/pisi/components/workspace-client.tsx`
- `docs/architecture/CURRENT_ARCHITECTURE.md`
- `docs/architecture/DATABASE_PROJECTION_CHECK.md`
- `docs/architecture/DOCX_RESOURCE_SAFETY.md`
- `docs/architecture/LOCAL_AI_PROVENANCE.md`
- `docs/architecture/SERVER_CONFIGURATION.md`
- `docs/release/CURRENT_STATUS.md`
- `docs/release/HTTP_AUTHORITY_MATRIX_2026-09-08.md`
- `docs/release/LOCAL_VERIFICATION_2026-09-07.md`
- `docs/release/OVERNIGHT_HARDENING_2026-09-08.md`
- `docs/release/PASS_PROMISE_MATRIX_2026-09-08.md`
- `docs/superpowers/plans/2026-09-07-overnight-hardening.md`
- `lib/academic-suite/process-facts.test.ts`
- `lib/academic-suite/process-facts.ts`
- `lib/academic-suite/state-issue-projection.test.ts`
- `lib/academic-suite/state-issue-projection.ts`
- `lib/agents/material-context-loader.test.ts`
- `lib/agents/run-context-access.test.ts`
- `lib/agents/run-context-access.ts`
- `lib/agents/run-context-loader.ts`
- `lib/deployment/agentic-preflight.mjs`
- `lib/deployment/agentic-preflight.test.js`
- `lib/deployment/release-readiness.test.js`
- `lib/docx/validation.js`
- `lib/docx/validation.test.js`
- `lib/docx/zip-fixture.js`
- `lib/docx/zip-resource-check.test.ts`
- `lib/docx/zip-resource-check.ts`
- `lib/katedra-free-starter.js`
- `lib/katedra-free-starter.test.js`
- `lib/manuscript/ai-ledger.test.ts`
- `lib/manuscript/ai-ledger.ts`
- `lib/manuscript/proposal-application.test.ts`
- `lib/manuscript/proposal-application.ts`
- `lib/manuscript/proposals.ts`
- `lib/manuscript/server-hydration.test.ts`
- `lib/manuscript/server-hydration.ts`
- `lib/materials/extractors.test.ts`
- `lib/materials/extractors.ts`
- `lib/stripe/duplicate-refund.js`
- `lib/stripe/duplicate-refund.test.js`
- `lib/stripe/entitlement-replay.ts`
- `package.json`
- `README.md`
- `scripts/agent-worker-local-contract-e2e.mjs`
- `scripts/agent-worker-local-contract-e2e.test.js`
- `scripts/check-database-projection.mjs`
- `scripts/check-database-projection.test.js`
- `scripts/pisi-workspace-ui-e2e.mjs`
- `tsconfig.strict.json`
