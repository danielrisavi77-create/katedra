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
| AI provenance | Current local accepted-proposal history and separate agent ledger | Workspace local history; per-run agent results | Neither is a complete cross-device interactive AI audit trail or proof of billing settlement |
| Logs / analytics | Explicit bounded operational projections | Request IDs, safe error codes and outcome events | No prompts, manuscript, attachment text, arbitrary provider errors or secrets |

## Shared state compatibility

`GET /api/state` requires a project ID, authenticates the user, resolves the owned project, and reads only that user's canonical project row. `PUT` checks origin, bounded JSON, project identity and locks; strips manuscript content before building an allowlisted patch; and retains the existing first guest-to-account synchronization path. Database errors and missing production lock configuration fail closed. The current writer remains `katedra_projects`; a design document mentioning `completion_project_state` is not evidence that its deployment or migration is complete.

## Approval, verification and retained bytes

Engineering approval in this conversation authorizes implementation work. It is not a persisted approval of any specific application's plan revision.

PR [#36](https://github.com/danielrisavi77-create/katedra/pull/36) is parallel gate/explicit-approval work. It was not in this branch's master baseline. When integrating, retain both its revision-bound user approval verification and this branch's active-manifest/expiry check. A valid manifest proves temporary access eligibility, not plan approval; an approved plan does not override revoked/expired content. No service or agentic flag has been enabled by this hardening work.

## OWNER_DECISION: DOCX ingestion and temporary content

The constitution says Katedra does not open DOCX and the shared backend must not store body text/raw DOCX. Existing semantic extraction and the agentic temporary-Storage contract do process or retain those bytes. General approval to execute an engineering plan does not settle this privacy authority conflict.

1. **Apply the literal constitution:** move DOCX ingestion to Lekta and keep content local. This requires redesigning remote-worker input and preserving current users' material workflows during migration.
2. **Permit transient semantic extraction only:** clarify that technical compliance remains Lekta's authority, while prohibiting retained server content. Remote asynchronous runs require a revised input transport.
3. **Permit explicit bounded private temporary content:** define consent, purpose, retention, deletion and revocation in the constitution and user copy; require canonical cleanup/orphan/replacement proof before activation.

No option has been silently selected. Current changes reduce risks within existing paths without expanding data collection or activating the service.

## Canonical work still required

- Prove tombstone/orphan recovery and scheduled physical deletion; access expiry alone is insufficient.
- Provide atomic context replacement semantics; overwriting fixed Storage objects and compensating deletes can destroy the previous context on partial failure.
- Prove shared billing/lease/entitlement/withdrawal contracts and RLS in staging.
- Resolve extraction resource safety: declared ZIP sizes and a promise timeout do not bound actual decompression or terminate ongoing work.
- Keep the two independent product signals: Katedra process progress and Lekta technical findings.
