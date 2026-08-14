# Katedra project-scoped AI access contract

`katedra_wallets` is currently user-global, while a Project Pass and free
starter grant are project-scoped. A global wallet balance therefore cannot by
itself authorize a no-Pass project.

When `KATEDRA_BILLING_RPC_CONTRACT=v2` is enabled, Katedra calls:

```text
katedra_authorize_project_ai(
  p_user,
  p_project_id
)
```

The function is owned by the Lekta repository and must atomically verify the
canonical project owner, active Project Pass or that project’s starter grant,
and the remaining project-scoped safety budget. For a successful no-Pass
decision it must return an object with:

- `status: "allowed"` and numeric `balance`, or
- a denial status such as `no_grant` / `insufficient_balance`.

An error, missing function, or unknown status is treated as unavailable and
Katedra returns HTTP 503 before contacting Anthropic. A denial returns HTTP
402. The old global-wallet fallback is retained only for development while
the v2 contract is not enabled; production already fails closed unless v2 is
configured.

Lekta must test that a wallet grant from project A cannot authorize project B,
that a repeated starter grant is idempotent, and that concurrent requests for
one project cannot spend the same remaining budget twice.
