# Katedra rate-limit and cost contract

The process-local `Map` in `lib/ai/rate-limit.js` is useful for development
and unit tests only. It cannot coordinate two tabs, two server instances, or a
server restart.

## Production requirement

Production must set `KATEDRA_RATE_LIMIT_STORE` to `supabase` only after the
atomic Lekta-side reservation contract is deployed and tested. The current
Supabase adapter calls `katedra_reserve_request` with
`(p_user, p_request_id, p_estimated_charge)` and
`katedra_release_request` with `(p_user, p_request_id)`. Other store labels
are rejected until a matching adapter is implemented; this repository does
not silently route a Redis label to the Supabase RPC.

If the implemented Supabase store is not configured in production, `/api/chat` fails closed with
HTTP 503 before contacting Anthropic.

## Atomic reservation behavior

The production store must perform the following in one transaction or
equivalent atomic operation:

- reserve a request for `(user_id, request_id)` and its bounded estimated
  charge;
- enforce the rolling per-minute limit;
- enforce the active-stream limit;
- enforce a daily user cost ceiling against reservations and reconcile the
  final observed charge during settlement;
- return an idempotent reservation result for retries;
- release exactly once on provider failure or stream cancellation.

The current route rejects oversized serialized message input and separately
caps base64 attachment payloads before provider streaming. The pure
`validateCostCeiling` helper is covered by unit tests. The production
reservation function must calculate the rolling and daily token/cost limits
atomically; the application no longer uses a non-atomic usage-row count as a
production substitute.

## Required staging test

Send at least nine parallel requests, plus two-tab requests for one user, and
verify that the configured limit is never exceeded across retries and server
instances. Verify that an aborted stream does not leave a permanent active
reservation.
