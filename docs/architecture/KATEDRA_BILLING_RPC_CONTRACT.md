# Katedra billing RPC contract

Katedra must not call Anthropic in a production environment until
`KATEDRA_BILLING_RPC_CONTRACT=v2` is configured. The v2 contract is owned by
the Lekta repository and must be deployed there; this repository does not add
or alter database migrations.

## Function

The canonical function remains `katedra_consume` and accepts:

- `p_user`: authenticated user UUID
- `p_project_id`: canonical `academic_project_id`
- `p_request_id`: UUID generated for the AI attempt
- `p_charged`: weighted internal token charge
- `p_model`: provider model identifier
- `p_in`: observed input tokens
- `p_out`: observed output tokens

Lekta migration `0083_billing_pending_marker.sql` also provides
`katedra_mark_pending(p_user, p_project_id, p_request_id,
p_estimated_charge, p_model)`. Katedra calls it when a provider attempt has
started but token usage or the consume result is not trustworthy. It creates a
durable `pending_reconciliation` billing attempt and releases only the rate
reservation; it must never be treated as a successful settlement.

It must return a row/object with `status` equal to `settled` or
`already_settled`. Any missing, unknown, or ambiguous result is treated as
`pending_reconciliation` by Katedra.

## Required behavior

The database function must be atomic and idempotent on `(user_id, request_id)`:

1. The first valid settlement debits the wallet and records usage.
2. Repeating the same request returns `already_settled` and does not debit
   again.
3. A different user or project cannot reuse another request’s identity.
4. A wallet failure returns a controlled error without a successful AI billing
   trace.
5. A timeout or unknown result remains reconcilable; it must not be retried by
   blindly issuing a second debit.

The Katedra process-local promise guard prevents duplicate work inside one
request, but it is not the idempotency mechanism. The database function is the
authority across retries, tabs, server instances, and reconnects.

## Project Pass duplicate protection

Checkout performs an optimistic active-Pass check, and the webhook repeats it
before granting a paid session. If another active Stripe Pass already exists
for the same `(user_id, academic_project_id)`, the later session is logged as
`duplicate_project_pass`, receives no second entitlement or wallet grant, and
is refunded through Stripe using an idempotency key derived from the later
session ID. If the session has no payment intent or the refund fails, the
webhook returns a non-2xx response and records a reconciliation-pending event;
it must not acknowledge the event as successfully handled.
This sequential defense-in-depth check does not replace a Lekta-side atomic
unique constraint or purchase-grant RPC; that contract must also make the
concurrent case safe and define the final refund/manual-review ownership for a
paid duplicate session. The Stripe refund is idempotent, but operations must
still monitor failed refund events.

## Release requirement

Before enabling the environment flag, Lekta must provide an integration test
covering two concurrent calls with the same `p_request_id`, a repeated call
after a successful settlement, insufficient balance, and a timeout/retry
reconciliation path. Until that evidence exists, chat fails closed with HTTP
503 before contacting Anthropic.
