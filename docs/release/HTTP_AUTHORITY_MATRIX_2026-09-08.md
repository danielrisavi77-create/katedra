# HTTP mutation authority audit

Read-only inventory of all 18 mutation handlers under `app/api`, plus the auth
callback. No PATCH handlers exist. This records application guards, not assumed
platform protections. Canonical RPC entries require authenticated staging proof.
All same-origin guards permit missing Origin outside production.

| Route | Auth | Origin | Ownership | Body limit | Rate limit | Private/no-store | Idempotency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST account/delete | Session | Same-origin | Current account | 16 KiB | No local limiter | Yes | Always unavailable (503) |
| POST auth/login | Credentials | Same-origin | N/A | 16 KiB | Supabase; no local limiter | Yes | No replay key |
| POST auth/password-reset | Public | Same-origin | N/A | 16 KiB | Supabase 429 | Yes | Repeat email request |
| POST agent-runs | Session + flag | Same-origin | Project, lock, Pass | 6 MiB | No local limiter | Yes | RPC lifecycle; no HTTP replay key |
| POST agent-runs/:id/context | Session + flag | Same-origin | Run, lock, Pass | 6 MiB | No local limiter | Yes | Non-atomic context replacement |
| POST agent-runs/:id/pause | Session + flag | Same-origin | Canonical RPC | Body unread | No local limiter | Yes | Canonical transition |
| POST agent-runs/:id/resume | Session + flag | Same-origin | Run, lock, Pass, RPC | Body unread | No local limiter | Yes | Canonical transition |
| POST agent-runs/:id/cancel | Session + flag | Same-origin | Canonical RPC | Body unread | No local limiter | Yes | Canonical transition |
| DELETE agent-runs/:id | Session + flag | Same-origin | Canonical cancel RPC | Body unread | No local limiter | Yes | Canonical transition |
| POST chat | Session | Same-origin | Project, capability/Pass or scoped starter | 32 MiB + content policy | Distributed in production | Yes, including SSE | Per-request billing; no HTTP replay key |
| POST checkout | Session | Same-origin | Project, work type, confirmation | 32 KiB | No local limiter | Yes | Stripe session creation has no key |
| POST internal/agent-worker | Dedicated token + flags | Service call | Atomic claim + scoped payload | 64 KiB | Lease; no request limiter | Yes | Canonical claim/completion |
| POST materials | Session + flag | Same-origin | Project + canonical Pass | 21 MiB multipart / 20 MiB file | Distributed in production | Yes | Fresh material UUID |
| DELETE materials/:id | Session + two flags | Same-origin | Project, tombstone RPC, exact paths | Body unread | No local limiter | Yes | Tombstone retry delegated |
| POST parse-docx | Session | Same-origin | Request-only extraction | 21 MiB multipart / 20 MiB file | Distributed in production | Yes | No persistent mutation |
| PUT state | Session | Same-origin | Project + narrow first-sync exception | 1 MiB | No local limiter | Yes | Upsert; no replay/version key |
| POST webhook | Stripe signature | Signed service call | Paid session, project, user | 2 MiB raw | No local limiter | Yes | Session-keyed contracts; exact purchase check after 23505 |
| POST withdrawal | Session | Same-origin | Current account | 32 KiB | Distributed reservation in production | Yes | Duplicate reservation; no response replay |
| GET /auth/callback | PKCE code + verifier cookie | External callback; internal redirect validation | Session exchange | Query only | No local limiter | Yes after a9b8b01 | One-time code |

`GET /api/balance` is an additional effectful read: an owned no-Pass project can
initialize its starter allowance through the canonical v2 authorization RPC,
or through the retained legacy grant path in development. It has session and
project ownership checks and private responses, but no mutation Origin guard or
local limiter. This audit preserves that existing compatibility behavior; actual
idempotent initialization belongs in canonical RPC verification. It is not a
paid entitlement or a charge authorization.

Headers supplied by `withRequestId` count in this matrix. Review anchors are the
route exports, `lib/http/json-body.js`, `request-origin.js`, and the shared
`lib/observability/request-id.js` / `private-response.js` helpers. Missing local
rate limits are inventory findings, not evidence of a particular exploit.

## Worker guarantees and proof limits

| Invariant | Actual local application tests | Required external proof |
| --- | --- | --- |
| Lease identity | `worker.test.ts` stops after stale lease rejection | Concurrent claims, expiry/reclaim, stale completion rejection in DB |
| Pause/cancel | Worker loop stops on backend pause/cancel; route skips paused/initializing runs | Cancellation during provider work; precedence across workers |
| Bounded retries | Transient/revision attempts below three retry; third rejects; billing/config failures do not retry | Atomic attempt counts across crashes/processes |
| Ambiguous billing | Pending reconciliation prevents provider retry; settled billing survives storage failure | Durable pending markers and crash recovery |
| Reservation/settlement | `billed-provider-execution.test.ts` exercises reserve/consume/release and failure exits | Concurrent budget enforcement and exactly-once debit |
| Invocation bound | `worker-loop.test.ts` limits claims per invocation | Lease duration, timeout and scheduler overlap |

These tests execute application code using synthetic backend adapters. The old
`test:e2e:agent-worker-contract` command name is retained for compatibility, but
its output now explicitly says `NOT_AN_INTEGRATION_TEST` and
`AGENT_WORKER_RESPONSE_FIXTURE_ONLY_PASS`. It executes canned response fixtures,
not the worker. An explicitly requested unsupported external mode exits 1.

## Unresolved persistence risks

- Context replacement overwrites fixed paths before later manifest operations;
  compensating deletion can destroy the old context. Material-selection update
  and context write are separate mutations. Canonical atomic/versioned replacement
  is required; a client-side reorder is insufficient.
- Tombstoned objects after failed removal and unregistered upload orphans need a
  canonical recovery sweeper. Local cleanup excludes tombstoned rows and has no
  production caller here. Access expiry is not physical erasure.
- Signed webhook identity checks do not prove canonical concurrent-purchase
  exclusion or wallet idempotency. Refund replay beyond Stripe's idempotency
  retention needs durable refund identity and update handling.
- Actual ZIP expansion is now bounded by `zip-resource-check.ts`, including
  trailing-stream and Unicode-path ambiguity checks. Promise timeouts still do
  not terminate extraction. Cancellable CPU isolation remains an open local
  hardening task, separate from Lekta's exclusive DOCX compliance authority.
