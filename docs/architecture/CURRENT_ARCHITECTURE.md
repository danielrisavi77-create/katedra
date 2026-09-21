# Current Katedra architecture — 2026-09-07

Scope: current master `24dfc1841f475ba31791c017d23267deaee796ff` plus the isolated overnight hardening branch. This map describes actual callers and retained compatibility, not every future architecture in historical plans.

| Domain | Authority | Actual persistence / consumer | Boundary and release dependency |
| --- | --- | --- | --- |
| Identity | Existing Lekta Supabase `auth.users.id` | Server session helpers; shared account routes | Server authentication; no separate identity database |
| Project | Canonical owned Academic Suite project | `lib/academic-suite/repositories/projects.ts`; guest alias compatibility | Resolve ownership before access; guest alias never grants ownership |
| Manuscript | Local manuscript model | `/pisi`, local storage/IndexedDB and explicit local exports | Canonical content is local-first; shared state must not store body text |
| Shared metadata | Project-scoped Katedra workflow | `/api/state` still upserts `katedra_projects` by user + guest alias | Existing foundation mirror contract remains necessary; do not remove legacy writes merely because newer tables exist |
| Document rules | Lekta Academic Core | Read-only `public/katedra-pack.json` and coach/profile projection | Refresh from Lekta `dist-packs/katedra-pack.json` in a coordinated, separate change if stale |
| Process policy | Sourced Katedra process facts | `public/katedra-process-facts.json`, server resolver | Empty/unknown facts are not verified permission; no invented institutional policies |
| DOCX compliance | Lekta deterministic engine | Versioned handoff/result and fresh re-check | Katedra cannot certify fields, margins, citations or compliance; `VERIFIED_FIXED` requires new Lekta evidence |
| Semantic extraction | Existing Katedra upload routes | `/api/parse-docx` transient extraction; materials extraction | Existing constitutional wording conflicts with this behavior; owner decision below, no competing compliance verdict |
| Interactive AI | Authenticated, owned-project server route | `/api/chat`; provider stream and billing RPCs | Entitlement, policy, project lock, input bounds and spend guard remain server-side |
| Agent run | Canonical run/step/lease RPC contract | Internal worker, provider executor, verifier and result storage | Feature availability is not activation approval; real provider/verifier and lease/RLS staging proof required |
| Temporary run content | Canonical active manifest plus scoped private Storage | `agent_payload_manifests`; private manuscript/material/result objects | TTL access checks do not prove physical deletion, atomic replacement or in-flight revocation |
| Pass | Project-specific entitlements | Checkout/webhook plus `lookupActiveProjectPass` / capability resolver | Wallet balance never authorizes a different project's Pass |
| AI budget | Project access / wallet spend authority | Canonical billing reservation, consume, pending and release RPCs | Local mocked tests cannot prove concurrent database atomicity |
| Payment | Signed Stripe event and canonical purchase contract | Webhook entitlement/grant/refund paths | Authenticated money-flow and replay/uniqueness proof remain external |
| Withdrawal | Durable receipt and reservation contract | `withdrawal_requests`, canonical reservation, email provider | Provider acceptance is not inbox delivery; failed confirmation must remain visible for reconciliation |
| AI provenance | Local manual-chat attempt/decision metadata, accepted-proposal history and separate agent ledger | Versioned local storage and metadata-only export; per-run agent results | Best-effort, 200 attempts per project; no prompt/body, cross-device guarantee or billing settlement claim |
| Logs / analytics | Explicit bounded operational projections | Request IDs, safe error codes and outcome events | No prompts, manuscript, attachment text, arbitrary provider errors or secrets |

## Shared state compatibility

The typed finding projection lives in `state-issue-projection.ts`; route auth,
origin, lookup, lock validation and persistence remain in the HTTP orchestrator.
Other legacy gen/history/log allowlists remain explicit in the route. This is a
bounded extraction, not a claim that the whole route or workspace is decomposed.

`GET /api/state` requires a project ID, authenticates the user, resolves the owned project, and reads only that user's canonical project row. `PUT` checks origin, bounded JSON, project identity and locks; strips manuscript content before building an allowlisted patch; and retains the existing first guest-to-account synchronization path. Database errors and missing production lock configuration fail closed. The current writer remains `katedra_projects`; a design document mentioning `completion_project_state` is not evidence that its deployment or migration is complete.

## Approval, verification and retained bytes

Engineering approval in this conversation authorizes implementation work. It is not a persisted approval of any specific application's plan revision.

PR [#36](https://github.com/danielrisavi77-create/katedra/pull/36) is parallel gate/explicit-approval work. It was not in this branch's master baseline. When integrating, retain both its revision-bound user approval verification and this branch's active-manifest/expiry check. A valid manifest proves temporary access eligibility, not plan approval; an approved plan does not override revoked/expired content. No service or agentic flag has been enabled by this hardening work.

## Approved temporary-content policy

Owner decision, 2026-09-08: bounded private temporary content is approved. Such
content requires explicit user consent, retention of at most 72 hours, and
deletion after consent withdrawal or run deletion. The owner separately approved
the prepared staging journal repair instead of rebuilding staging. Neither
decision activates the service or substitutes for a user's run/plan approval.
Katedra records explicit consent before storing a run context. Withdrawal works
after Pass expiry and feature shutdown. Canonical Lekta upload intents track each
context/result object before its upload; uncertainty blocks physical deletion
acknowledgement. Result retries use the same allocation, expiry and bytes. The
canonical cleanup worker reconciles matching bytes/version before deleting them.
These changes still require authenticated staging and physical deletion evidence.

## Canonical work still required

- Prove tombstone/orphan recovery and scheduled physical deletion; access expiry alone is insufficient.
- Verify the implemented atomic context replacement on staging, including interrupted upload and stale revision rejection.
- Complete tracked unbound-material uploads and original provider-response recovery; result persistence alone is not provider execution recovery.
- Prove shared billing/lease/entitlement/withdrawal contracts and RLS in staging.
- ZIP output is now checked against actual bounded inflation. Cancellable extraction isolation remains open: a promise timeout does not terminate ongoing work. See `DOCX_RESOURCE_SAFETY.md`.
- Keep the two independent product signals: Katedra process progress and Lekta technical findings.
