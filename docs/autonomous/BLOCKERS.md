# V1 external blockers

These are not solved by local UI or test changes and must not be faked as
complete.

## BLOCKED_EXTERNAL: canonical Lekta agent contract

Evidence: `npm.cmd run preflight:agentic` currently reports missing
`KATEDRA_WORKER_APP_URL`, `KATEDRA_AGENT_WORKER_TOKEN`,
`KATEDRA_AGENT_WORKER_CRON_SECRET`, `KATEDRA_AGENT_MODEL`,
`KATEDRA_AGENT_RUNS_ENABLED`, `KATEDRA_PROJECT_LOCKS_ENABLED`,
`KATEDRA_BILLING_RPC_CONTRACT` and `KATEDRA_RATE_LIMIT_STORE`.

The production preflight also intentionally fails without
`KATEDRA_PROJECT_LOCKS_ENABLED`; checkout and webhook have the same runtime
fail-closed guard.

Required owner action: deploy and verify Lekta migrations/RPCs, RLS, worker
lease/claim, payload cleanup and staging credentials. The local follow-up
Migrations `0077`-`0083` now cover material tombstoning, exact Pass checks for
worker lifecycle transitions, lease-expiry protection, billing-ceiling
accounting and atomic replacement of a run's selected input materials, but
they are not canonical until deployed. Then rerun the
read-only preflight and the authenticated agentic E2E before enabling flags.

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

## BLOCKED_EXTERNAL: atomic paid project-lock idempotency

Evidence: the original local Lekta contract in
`Lekta/supabase/migrations/0067_agentic_run_contract.sql` performed a
read-before-insert in `lock_paid_project`. A local follow-up fix now exists in
`Lekta/supabase/migrations/0074_atomic_project_lock_idempotency.sql` (Lekta
commit `cb1b16f`), with a source-contract test, but it has not been deployed or
proven against the canonical Supabase project. Katedra fails closed on
malformed or mismatched responses, but production safety still depends on the
canonical migration and a real concurrency test.

The local Lekta contract suite currently passes for the available agentic
contract, billing, payload-attachment, payload-tombstone and worker-dispatcher
fixtures. Lekta's full local check also passes (typecheck, Vitest and Vite
build). This is local source evidence only; it does not prove that the
canonical RPCs, RLS policies or worker are deployed.

Required owner action: update the canonical Lekta RPC to use an atomic
conflict-safe insert/claim path that verifies the existing immutable snapshot,
then add a database concurrency test and staging proof for two simultaneous
identical payment/project requests before enabling paid production traffic.

## BLOCKED_EXTERNAL: canonical material payload contract deployment

Evidence: the local Lekta contracts now exist in
`Lekta/supabase/migrations/0077_agent_payload_tombstone.sql` and
`Lekta/supabase/migrations/0082_replace_agent_payloads_for_run.sql` and the
durable billing marker in `Lekta/supabase/migrations/0083_billing_pending_marker.sql`.
`app/api/materials/[materialId]/route.js` calls the tombstone RPC only when
`KATEDRA_MATERIAL_DELETE_RPC_CONTRACT=v1` is explicitly enabled. The route
validates the canonical returned paths before removing private objects, and
the local contract tests cover ownership, active-run rejection and idempotent
tombstoning. The agent context route now uses the replacement RPC so removing
all or changing selected materials is atomic; the production/staging
deployment and database proof are still missing, so these features remain
fail-closed.

The materials feature remains disabled by the existing production flag, so this
is a pre-activation blocker rather than an enabled production incident. A
direct Katedra update would violate the database authority rule.

Required owner action: deploy migrations `0077` through `0083` to the canonical
Lekta environment, set `KATEDRA_MATERIAL_DELETE_RPC_CONTRACT=v1` only there,
and run staging tests proving that a deleted material cannot be attached, that
replacement cannot partially mutate a run, and that repeated deletion is
idempotent. Keep the flags unset until that proof exists.

Local Supabase execution is not currently available either: the installed CLI
reports that the Docker engine pipe is missing when inspecting the local
project. Therefore the repository-level SQL tests are the strongest available
local evidence; no local database/RLS concurrency result is being represented
as a deployment proof.

An attempted per-user install from Docker's official x86_64 download endpoint
was rejected by Windows as an invalid application platform. The temporary
installer was removed after the failed launch; Docker Desktop remains
uninstalled and this requires a manual/system-level installation path or a
staging Supabase environment.

## BLOCKED_EXTERNAL: web/vision provider activation

The local agent worker currently wires only the text Anthropic adapter. The
product contract exposes `web_research` and scan/vision paths, but no
provider-specific web/vision adapter or staging credential is configured.
The worker therefore fails closed when a step requires an unavailable
capability; these options must not be treated as production-ready.

Required owner action: configure and test the provider router with the approved
web and vision adapters, including source URL/DOI verification, then add a
staging run proving research, OCR, citation evidence and the three-attempt
quality gate before enabling those capabilities.
