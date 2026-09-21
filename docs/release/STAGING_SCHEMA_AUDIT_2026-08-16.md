# Staging schema audit — 2026-08-16

## Scope

This is a read-only verification of the Lekta staging project used by Katedra.
It records whether the canonical project-lock, billing, material and agent-run
contracts are safe to activate. It does not apply migrations, repair migration
history, change RLS, or enable production features.

## Environment verified

- Supabase project: Lekta staging
- Project ref: `bnyemcnsphlitjradrst`
- CLI: `supabase@2.109.1` from the Lekta repository
- Verification date: 2026-08-16
- Katedra agentic flags remain disabled:
  - `KATEDRA_PROJECT_LOCKS_ENABLED=false`
  - `KATEDRA_AGENT_RUNS_ENABLED=false`
  - `KATEDRA_MATERIALS_ENABLED=false`

## Migration-history result

The linked migration history is not currently reconciled with the local Lekta
migration directory.

- Local and remote history matches through migration `0038`.
- Local migrations `0039` through `0085` are not recorded as applied remotely.
- The remote history also contains multiple timestamp-only migrations in the
  `20260814...` range that are not present in the local migration directory.
- A linked `db push --dry-run` failed closed because remote migration versions
  are missing locally. No database mutation was made.

This means it is not safe to run `db push`, `migration repair`, or a guessed
subset of migrations. The migration source of truth must first be reconciled by
the Lekta owner, with the remote-only migrations identified and preserved where
they represent real shared state.

## Live contract result

The staging database contains core tables for the agentic workflow, including:

- `agent_runs`
- `agent_steps`
- `agent_payload_manifests`
- `katedra_project_locks`
- `katedra_project_state`
- `katedra_request_reservations`
- `katedra_billing_attempts`

RLS is enabled on the core agent/run/payload/lock tables. The inspected core
tables have policies; the request-reservation table has no client policy and
appears intended for service-only access.

The staging function inventory is incomplete relative to the current Katedra
contract. The following functions were not found in the linked staging
database:

- `replace_agent_payloads_for_run`
- `activate_agent_run`
- `cleanup_stale_initializing_agent_run`

Those functions are required by the current Katedra agent-run path or stale-run
recovery contract. The staging database still exposes the legacy
`attach_agent_payloads_to_run` function to authenticated callers. The local
Lekta migrations include a later revocation for that legacy path, but that
revocation is not represented in the linked staging migration history.

The inspected owner-facing functions (`create_agent_run`, `register_agent_payload`,
`pause_agent_run`, `resume_agent_run` and `cancel_agent_run`) use security
definer execution. This is acceptable only with the existing auth, ownership,
project-lock and entitlement guards; each function still requires canonical
staging verification before activation.

## Advisor results

Read-only database checks returned:

- `db lint`: one warning in `public.generate_referral_code` for a shadowed
  loop variable / unused variable.
- Security advisor: `vector` is installed in the public schema. Several
  security-definer functions are executable by authenticated users, including
  the legacy payload attach function noted above.
- Performance advisor: existing RLS policies use `auth.*()` directly in row
  predicates on several unrelated tables instead of the init-plan form
  `(select auth.*())`. This is a performance optimization backlog, not proof
  that the Katedra agent contract is safe to enable.

## Release decision

The staging contract is **not ready for activation**. Keep project locks,
materials and agent runs fail-closed until all of the following are completed
in the Lekta repository and verified against staging:

1. Reconcile local and remote migration history without deleting or falsely
   marking shared migrations.
2. Deploy and verify the canonical project-lock, payload replacement,
   activation and stale-run recovery contracts.
3. Revoke or otherwise remove authenticated access to the legacy payload attach
   path, then confirm the replacement path is atomic and idempotent.
4. Run ownership, RLS, duplicate-claim, pause/resume, TTL cleanup and billing
   reconciliation tests with real staging credentials.
5. Re-run the Katedra preflight and authenticated browser money-flow/agent-run
   release tests.

The current local Katedra implementation remains deliberately fail-closed, so
this audit does not claim that the agentic workflow is deployed or production
ready.
