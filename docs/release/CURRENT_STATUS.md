# Current release status — 2026-09-08

**Local hardening verified; draft review handoff, service activation is not approved.** The final scope and remaining work are recorded in [OVERNIGHT_HARDENING_2026-09-08.md](OVERNIGHT_HARDENING_2026-09-08.md). Local checkpoints remain in [LOCAL_VERIFICATION_2026-09-07.md](LOCAL_VERIFICATION_2026-09-07.md). Actual authority and unresolved privacy choices are mapped in [CURRENT_ARCHITECTURE.md](../architecture/CURRENT_ARCHITECTURE.md). Historical release documents remain historical evidence and are not superseded by a claim of production readiness.

## PR reconciliation against master 24dfc18

| PR | Classification | Reason / next action |
| --- | --- | --- |
| [#19](https://github.com/danielrisavi77-create/katedra/pull/19) | PARTIALLY_SUPERSEDED | Docs-only V2 roadmap at `b668d94`; portions of its typed admin/entitlement/test foundation already exist on master. Broader completion/policy architecture remains a roadmap and needs current authority review. Do not cherry-pick it as an implementation fix. |
| [#21](https://github.com/danielrisavi77-create/katedra/pull/21) | REQUIRES_REBASE; REQUIRES_OWNER_DECISION | Workflow-authority proposal at `cd8f736` predates current project-specific state privacy/ownership protections. Its new completion-table projection does not establish deployed authority. Reconcile with current state route and canonical Lekta contract before considering merge. |
| [#36](https://github.com/danielrisavi77-create/katedra/pull/36) | CURRENT_AND_RELEVANT; parallel integration | Gate/explicit-approval work at `fd5b108` is not in the baseline. Worker/context overlap must preserve both revision-bound approval and active temporary-content checks. Local approval/service tests are not service activation. |

## Open issue classification

| Issue | Classification | Remaining evidence |
| --- | --- | --- |
| [#23](https://github.com/danielrisavi77-create/katedra/issues/23) | BLOCKED_EXTERNAL | Canonical Lekta RPC/RLS deployment and authenticated ownership proof |
| [#24](https://github.com/danielrisavi77-create/katedra/issues/24) | BLOCKED_EXTERNAL | Account deletion and temporary payload cleanup including tombstone/orphan recovery |
| [#25](https://github.com/danielrisavi77-create/katedra/issues/25) | BLOCKED_EXTERNAL | Authenticated Stripe checkout/webhook/replay and actual grant/consume flow |
| [#26](https://github.com/danielrisavi77-create/katedra/issues/26) | OWNER_DECISION; PARTIALLY_FIXED | Constitutional content/Storage choices remain open; local expiry guard reduces access risk but does not establish deletion |
| [#27](https://github.com/danielrisavi77-create/katedra/issues/27) | PARTIALLY_FIXED; BLOCKED_EXTERNAL | Local receipt/confirmation reporting improved; deployed durable receipt, reservation and email proof still required |
| [#29](https://github.com/danielrisavi77-create/katedra/issues/29) | OPEN_VALID; BLOCKED_EXTERNAL | Verified policy pilots and institutional source/date/scope evidence; do not fabricate pack entries |
| [#30](https://github.com/danielrisavi77-create/katedra/issues/30) | PARTIALLY_FIXED; BLOCKED_EXTERNAL | Promise matrix and inaccurate copy corrected; authenticated paid workflow evidence still required |
| [#31](https://github.com/danielrisavi77-create/katedra/issues/31) | BLOCKED_EXTERNAL | Real provider and independent verifier staging journey |
| [#32](https://github.com/danielrisavi77-create/katedra/issues/32) | PARTIALLY_FIXED; OWNER_DECISION already recorded | Readback showed strict required `check`, `browser-e2e`, `gitleaks`, admin enforcement and no force-push/delete. Owner explicitly chose zero mandatory approving reviewers; do not restore the stale issue's second-reviewer requirement. Remaining release/negative-enforcement evidence is not claimed. |

Issues remain open. A local regression test or mocked RPC is not evidence to close a deployment issue.

## Current implementation checkpoint

- Chat reserves the maximum permitted output estimate before wallet/starter side effects. The later affordable output may be smaller: conservative reservation can reject a request near the daily ceiling that a more precise atomic reservation would allow. No spend limit has been relaxed.
- Streaming chat responses explicitly disallow storage in caches.
- Withdrawal confirmation checks resolved email API errors and reports pending reconciliation if email acceptance or persistence fails, preserving the durable receipt.
- Material extraction keeps its truncation marker within the consumer's size bound and checks image extension/MIME agreement before OCR.
- Worker context access checks canonical manifest presence, exact scope and canonical/private expirations before reading manuscript content. This does not promise atomic revocation during an in-flight download.
- Duplicate refunds require successful provider status; unique entitlement conflicts require exact purchase identity before wallet grant.
- Workspace hydration/proposal races, destroyed-editor section transitions and purchase-context consent/focus behavior have local regression and browser evidence.
- Institutional policy unlocks require sourced, verified, valid non-future dates and applicable scope. Course/program identity remains unresolved; old-but-valid dates are not a freshness guarantee.
- Ordinary chat has bounded, metadata-only local provenance and separate export. Storage failures remain visible; cross-device persistence and billing settlement are not claimed.
- Auth callback redirects are private and bounded; state finding projection is typed; an offline supplied-source schema checker and scoped strictness ratchet are available.

Latest complete local checkpoint: 1033 passed tests, 4 skipped; typecheck, strict
check, lint, build and three browser scripts passed. See the verification record
for the distinction between component fixtures, guest browser checks and external
authenticated evidence. [The HTTP matrix](HTTP_AUTHORITY_MATRIX_2026-09-08.md)
documents each mutation boundary and unresolved canonical recovery guarantees.

ZIP expansion now checks actual bounded output and container agreement; hard CPU termination remains open. Dependency audit still reports 28 moderate advisories. Production, agentic and release preflights fail closed on missing configuration/evidence.

The full overnight checklist is tracked in [the implementation plan](../superpowers/plans/2026-09-07-overnight-hardening.md). The final report records a partial product outcome and a draft PR handoff, not merge or activation approval.
