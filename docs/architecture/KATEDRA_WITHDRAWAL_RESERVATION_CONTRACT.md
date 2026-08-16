# Katedra withdrawal reservation contract

The withdrawal endpoint must use a durable reservation in production. The
local in-memory limiter is allowed only for development and tests. The
database/RPC implementation is owned by the Lekta repository; Katedra does
not add production DDL here.

## Reserve

Function: `katedra_reserve_withdrawal`

Arguments:

- `p_user`: authenticated user UUID;
- `p_reference_id`: optional client/request reference, or `NULL`.

The function must return one row/object with `status`:

- `reserved` — this request may create one withdrawal row;
- `duplicate` — the reference is already reserved or completed;
- `rate` — the durable user limit was reached;
- any other value is treated as `unavailable` and Katedra fails closed.

The decision must be atomic across all application instances. If a reference
ID is supplied, it must be unique for the user. Reservations that are not
completed must have a bounded lease or be explicitly released, so a crashed
request cannot permanently block that user.

## Release

Function: `katedra_release_withdrawal`

Arguments:

- `p_user`: authenticated user UUID;
- `p_reference_id`: the same optional reference passed to reserve.

Release must be idempotent. It is called when production configuration is
missing or when the withdrawal row cannot be inserted. A successful insert is
not released by Katedra; it is committed below.

## Commit

Function: `katedra_commit_withdrawal`

Arguments:

- `p_user`: authenticated user UUID;
- `p_reference_id`: the same optional reference passed to reserve;
- `p_request_id`: the durable `withdrawal_requests.id` created by Katedra.

The function must return `committed` or `already_committed`. It atomically
marks the reservation as completed and binds it to the durable request row.
An unknown result is treated as pending reconciliation. Katedra does not
release a reservation after a successful insert when commit is unavailable.

## Required database guarantees

- two concurrent reservations for the same `(user_id, reference_id)` result in
  only one `reserved` response;
- the rate limit is shared across instances and survives a process restart;
- a reservation cannot authorize an insert for a different user;
- timeout/unknown RPC results are `unavailable`, never a local fallback in
  production;
- commit is idempotent on the durable request identity and a failed commit is
  observable for reconciliation;
- the corresponding `withdrawal_requests` table must have a durable unique
  constraint for non-null request references, or the creation must be folded
  into an atomic RPC.

## Katedra behavior

When `KATEDRA_RATE_LIMIT_STORE=supabase`, Katedra calls these functions and
returns HTTP 503 if the contract is missing, errors, or returns an unknown
status. When the flag is not enabled, development/test uses the process-local
adapter. Production preflight requires the Supabase store flag.
