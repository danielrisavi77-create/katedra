# Katedra admin override

Katedra has one explicit support override for the confirmed account configured
by `KATEDRA_ADMIN_EMAILS`.

## Security boundary

- `KATEDRA_ADMIN_OVERRIDE_ENABLED` must be explicitly `true`.
- The authenticated Supabase user's exact confirmed email must match the
  comma-separated server-side allowlist.
- `user_metadata` is never used for authorization.
- Canonical project ownership is still required for every project operation.
- The override is available only when `NODE_ENV` is not `production`; it is a
  local development/support convenience, never a production entitlement.
- The override does not create a Stripe Pass, alter Lekta entitlements, or
  bypass global rate/concurrency/input-size protection.
- In local development, provider usage is intentionally free for the
  allowlisted account and the real provider cost remains an application
  responsibility. Production always uses the normal Pass, wallet, policy and
  billing gates.
- In local development only, the override may use the provider without the
  Lekta billing RPC configured; the request is never presented as settled and
  no billing RPC is called. Production always requires the real v2 settlement
  contract.
- Agent runs and material workflows remain unavailable until their canonical
  Lekta contracts and feature flags are enabled; admin access does not turn on
  incomplete infrastructure. Once enabled, the agent-run RPC still requires
  the canonical locked project and exact active Pass. Adding a free admin
  agent-run path requires a separate Lekta RPC contract; the Katedra route
  must not bypass that database invariant.

## Configuration

Local development uses:

```env
KATEDRA_ADMIN_OVERRIDE_ENABLED=true
KATEDRA_ADMIN_EMAILS=danielrisavi77@gmail.com
```

Production must not enable this override. Keep
`KATEDRA_ADMIN_OVERRIDE_ENABLED=false` and omit the allowlist from the
protected production environment; these values must never be exposed as
`NEXT_PUBLIC_*` variables.

## Admin page

The protected `/admin` page reads `/api/admin/overview`. That API returns only
the allowlisted user's own project, run, usage and non-secret feature-flag
status. It never returns the allowlist, service-role key, manuscript text or
provider credentials.
