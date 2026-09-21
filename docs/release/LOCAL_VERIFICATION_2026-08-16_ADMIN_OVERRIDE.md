# Local verification - admin override boundary - 2026-08-16

This release note records the production-boundary hardening shipped in commit
`9a5872e`. It does not claim that canonical Lekta/Supabase staging is live.

## Change

- The allowlisted admin override is available only when `NODE_ENV` is not
  `production`.
- Production chat, balance, capability and checkout routes use the normal
  project ownership, Pass, wallet, policy and billing gates.
- Local development keeps the explicitly configured Daniel account free for
  testing, without creating a Stripe entitlement or calling the billing RPC.

## Verification

Local checks passed:

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

Results:

- Vitest: `198 passed files`, `850 passed tests`, `4 skipped`.
- Focused admin/chat/balance/checkout/capability tests: `53 passed`.
- `GET http://localhost:3000/pisi`: HTTP 200 and workspace present.

Remote `master` gates for `9a5872e` passed:

- [Foundation check](https://github.com/danielrisavi77-create/katedra/actions/runs/31972962218)
- [Academic Suite browser E2E](https://github.com/danielrisavi77-create/katedra/actions/runs/31972962282)

The browser workflow skipped staging-dependent authenticated commerce, agentic
worker and provider steps because deployment credentials are not configured.
Those remain external release blockers.
