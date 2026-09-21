# Release integration progress, 2026-09-08

The active objective is the full five-action follow-up to PR #37. This checkpoint
does not close that objective or authorize service activation.

## Requirement and evidence ledger

| Requirement | Current evidence | Remaining work |
| --- | --- | --- |
| Review #37 and settle temporary content | Reviewed current #37 head `27aa135`, its #36 overlap and existing Storage behavior. Three concrete options are in CURRENT_ARCHITECTURE.md; owner selection was requested. | Owner decision remains pending; no constitution or privacy promise is silently changed. |
| Canonical deletion, context replacement and billing reconciliation in Lekta | Current Lekta master `f1a67234` inspected. Actual staging has deletion functions/columns absent from that master. The exact staging migration was saved outside repositories for comparison. | Recover canonical migration identity/source, secure physical-deletion finalization, implement atomic versioned context replacement and durable reconciliation; verify real RPC/storage behavior. |
| Reconcile #36 with katedra-pkg #48 and prove user approval | Combined #36 `fd5b108` with #37 on `codex/release-integration`. Active canonical context checks now also precede approval preview/confirmation and gate context loading. Real local app-client HTTP to service #48 `8ce1f924` passes both tests. | Authenticated staging journey and final coordinated review remain required. |
| Institutional policy and paid staging flows | Existing policy gates retained; no unverified institutional permission added. | Reviewed policy sources/freshness/applicability and actual paid staging journey remain unproved. |
| Final release gates before activation decision | Combined local typecheck, strict check, lint, full suite and build pass; local browser and actual service checks below. | Commit-bound canonical/authenticated release evidence and full release preflight still required. |

## Combined approval and active context

Simple textual conflict resolution would have left #36's gate snapshot reader
outside #37's canonical manifest checks. A runtime regression reproduced this:
execution reached plan approval instead of stopping on revoked context.

`loadActiveRunContextSnapshot` now checks the canonical manifest's scope and
expiry, validates its bounded private descriptor, then reads the manuscript.
Approval is returned only when that same descriptor matches the body's context
revision. The descriptor is not re-downloaded after the body, preventing a mixed
revision from supplying approval. The manuscript-only reader delegates to this
same boundary. GET/POST plan approval and worker gate/approval checks use it.

The worker retains #36's rule that the provider executes exactly the manuscript
and verified planning results checked for approval. Neither active content nor
a structurally complete plan substitutes for the user's revision-bound action.
New tests cover revoked context, expired approval-route input, revision mismatch,
legacy context and descriptor replacement during reading.

## Local verification of combined code

- Typecheck, scoped strict check and lint: exit 0, no lint warnings.
- Focused context/worker/approval routes: **50 tests passed**.
- Full suite: **217 files passed, 4 skipped; 1091 tests passed, 4 skipped**.
- Production build: exit 0.
- `PISI_WORKSPACE_BROWSER_E2E_PASS` on the production build at port 3020.
- `AGENT_PLAN_APPROVAL_UI_SMOKE_PASS`: 390/1440 px, approved/unapproved states;
  explicitly local API/auth fixtures and a simulated feature prop, not staging.
- Real app-client HTTP to the unchanged service #48: **2 tests passed**. A complete
  plan without approval is blocked; current approval runs the writing gate;
  changed scope is blocked. Synthetic local credentials/content only.

## Actual staging observations, read-only

Target: the connected **Lekta staging** project `bnyemcnsphlitjradrst`, observed
ACTIVE_HEALTHY. Production was not modified or used for test transactions.

The migration journal contains `20260822063559`, named
`0086_agent_snapshot_privacy_and_cleanup`, which does not exist in current Lekta
master. Master's `0086` is instead `academic_audit_insert_grants`. The staging
journal also contains historical duplicate identities. Do not deploy by comparing
the numeric suffix alone, and do not use MCP apply_migration: Lekta's instructions
require the canonical CLI migration path.

Readback confirms deletion request/finalization functions and
`deletion_requested_at`, `content_deleted_at`, `deletion_error` on manifests.
Both `finalize_agent_run_payload_deletion` and `finalize_user_agent_payload_deletion`
are executable by authenticated clients and mark physical completion from supplied
IDs without Storage deletion proof. The global finalizer is service-role-only.
This is an authority gap to fix and test, not evidence that deletion is complete.

Types were freshly generated via the connected staging project, saved outside
the repo and supplied to `npm run check:database-projection`. Result:
`DATABASE_PROJECTION_MATCH`. This covers the checker's consumed entitlement
Row/Insert/Update and internal metadata only, not all RPCs or production parity.
Generated file SHA256:
`1cf0ca913e83c0ca84f9dbfc2871af0a22cb987bbb0144600d09f984cf1d7853`.

The Lekta master CI tool reports green completed workflows and separately reports
a failing production scheduled smoke. That distinction remains open; no local
pass here resolves the production smoke.

## Next work

Restore and review the canonical deletion source with reproducible database tests,
then implement versioned context replacement and reconciliation in Lekta with
matching Katedra consumers. The requested owner content decision and institutional
review remain pending. Preserve existing user work and keep activation flags off.
