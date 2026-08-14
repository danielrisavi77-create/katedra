# V1 external blockers

These are not solved by local UI or test changes and must not be faked as
complete.

## BLOCKED_EXTERNAL: canonical Lekta agent contract

Evidence: `npm.cmd run preflight:agentic` currently reports missing
`KATEDRA_WORKER_APP_URL`, `KATEDRA_AGENT_WORKER_TOKEN`,
`KATEDRA_AGENT_WORKER_CRON_SECRET`, `KATEDRA_AGENT_MODEL`,
`KATEDRA_AGENT_RUNS_ENABLED` and `KATEDRA_PROJECT_LOCKS_ENABLED`.

The production preflight also intentionally fails without
`KATEDRA_PROJECT_LOCKS_ENABLED`; checkout and webhook have the same runtime
fail-closed guard.

Required owner action: deploy and verify Lekta migrations/RPCs, RLS, worker
lease/claim, payload cleanup and staging credentials. Then rerun the read-only
preflight and the authenticated agentic E2E before enabling flags.

## BLOCKED_EXTERNAL: authenticated commerce proof

Evidence: local checkout/webhook/capability tests exist, but no verified
authenticated Stripe test checkout plus canonical entitlement can run without
staging Supabase and Stripe credentials.

Required owner action: provide/use staging credentials and execute G2-G7 and
G9-G10 with real test accounts and test payment events.

## BLOCKED_EXTERNAL: account deletion authority

`POST /api/account/delete` intentionally fails closed until the canonical
identity service is connected. The account UI exposes the control honestly; it
does not claim deletion succeeded.

Required owner action: define and connect the canonical identity deletion
workflow, then add its authenticated integration test.
