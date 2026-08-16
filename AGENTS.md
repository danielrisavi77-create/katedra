# Katedra autonomous engineering rules

## Product completion target

Work toward `V1 PRODUCT COMPLETE` as defined in the autonomous completion
criteria and Golden Journeys under `docs/autonomous/`. Do not invent P4
features when a required P0–P3 issue remains unresolved.

## Non-negotiable boundaries

- Katedra owns academic process, planning, evidence quality, writing workflow,
  mentor feedback and defense preparation.
- Lekta is the only technical DOCX/compliance authority.
- The manuscript is local-first canonical content; never send full manuscript
  text through `/api/state` or put it in shared logs.
- Entitlements are project-specific and must be checked server-side. Wallet
  balance is never an authority for product access.
- AI proposals require verification and user confirmation unless the user has
  explicitly activated the bounded autonomous mode. Autonomous mode still
  requires source, policy, billing and quality gates.

## Development loop

Before substantive changes: inspect the current Git state, relevant
architecture documents, and recent tests. Fix the highest-priority
evidence-backed root cause, add a regression test when feasible, run focused
tests, then run typecheck, lint, test and build. For UI or integration work,
verify the affected route on localhost and run the available browser checks.

Never expose secrets, reset user work, weaken authorization, or enable agentic
feature flags before the canonical Lekta preflight and staging release gate
pass.
