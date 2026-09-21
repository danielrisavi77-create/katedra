# Local AI provenance and future synchronization

Ordinary workspace chat now records version 1 metadata in a project-scoped local
key, retaining at most 200 attempts. It records request time, action, section and
proposal IDs, response outcome, decision/time, and bounded server-reported model
and trace ID when present. Manual user initiation is explicit. Source backing,
institutional policy context and billing settlement remain `unknown`; a completed
stream is not proof of any of them.

No prompt, response text, manuscript revision, attachment name or provider error
is stored. Reads, writes and JSON export all use an explicit projection. Unknown
schema versions are not overwritten. Existing accepted-change history remains
separate; old rows are not converted into invented requests.

Acceptance is recorded after the editor confirms application. Rejection is an
explicit user action. Navigation discards a completed, unaccepted proposal and
cancels a pending attempt locally. Browser cancellation does not prove the remote
provider stopped or that billing was reversed. A pending row after a crash has
an unknown final outcome. Transient write failures remain visible for that
attempt even if a later write succeeds; memory tracks actual outcome separately
so failed persistence cannot relabel completion as cancellation.

History exposes a separate metadata-only JSON download and reports unavailable
storage. This is best-effort local history, not an immutable or synchronized
audit trail. Concurrent browser tabs can race localStorage writes. Clearing
browser data removes it; manuscript backup does not include this separate ledger.

## Proposed cross-device boundary — not implemented or deployed

Lekta must own any persistence migration, RLS, retention/deletion behavior and
append/update authority. This repository adds no table, RPC or network adapter.
Before implementing synchronization, coordinate a repository interface with:

```typescript
interface AiProvenanceRepository {
  listOwnedProject(projectId: string, cursor?: string): Promise<MetadataPage>
  appendOwnedAttempt(projectId: string, record: VersionedAttemptMetadata): Promise<WriteReceipt>
  recordOwnedDecision(projectId: string, proposalId: string, decision: UserDecision): Promise<WriteReceipt>
}
```

These are design placeholders, not existing production types or callable RPCs.
Authentication determines user identity server-side; supplied project IDs never
grant ownership. The canonical contract must define idempotency, legal state
transitions, conflict handling, pagination, erasure and retry semantics. Do not
reuse trace IDs as billing keys or infer billing success from a provenance row.
Unknown source/policy/model values must remain unknown until an authoritative
producer supplies them. Cross-device acceptance tests must cover foreign-owner
denial, duplicate delivery, concurrent decisions, offline reconciliation and
account deletion against the actual deployed contract.
