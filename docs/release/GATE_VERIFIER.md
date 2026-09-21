# Agent gate verifier

Katedra calls the separately deployed katedra-pkg service at `POST /v1/verify?wait=1`.
It sends the run manuscript, current agent result, profile hint and a plan derived
from previously stored, verified structure/planning artifacts. No new database
schema, table or stored payload is introduced. The existing citation/passage
verifier still runs; the stricter status wins and findings are combined.

| Server variable | Default | Purpose |
| --- | --- | --- |
| `KATEDRA_GATE_VERIFIER_URL` | unset | Service base URL (HTTPS in deployment) |
| `KATEDRA_GATE_VERIFIER_TOKEN` | unset | Service token, matching its `KATEDRA_VERIFIER_TOKEN` |
| `KATEDRA_GATE_VERIFIER_REQUIRED` | `false` | Fail closed when the service is not configured |
| `KATEDRA_GATE_VERIFIER_TIMEOUT_MS` | `120000` | Request timeout in milliseconds |

With no configured service, verification retains the citation result and adds an
informational `gate_step_skipped`. With REQUIRED=true, a missing service requires
revision. A configured service that fails or returns malformed data also requires
revision. Neither path downgrades an existing blocked/failed result.

PLAN:JSON blocks merge chapter fields by sectionId. Legacy STRUKTURA tables and
Teza lines remain a fallback; unique matching chapter titles resolve to existing
manuscript section IDs. The request also carries the current step sectionId. A structurally complete plan is only input to the
service gate; it does not replace student confirmation or judge plan quality.
Artifact selection omits the provider upstream-agent filter, but keeps the run,
project, verified-status, earlier-step and output-size restrictions. Thus citation
and export also receive structure/planning artifacts.

Operational logs contain phase, pass/fail, step identifiers/states/blocking flags
and exit code. They omit manuscript text, agent output, finding messages and raw
errors. Gate findings join the existing private result/verification workflow.

Deploy and verify the external service separately before configuring these
variables. No runtime credentials or feature flags are changed by this PR.
The service must preserve Lekta as the sole technical DOCX/compliance authority;
Katedra does not add a document validator or change the Lekta contract.

## Explicit plan approval

The matching service release is katedra-pkg 1.9.41 or newer. planReady means
structural completeness; planApproved means a current, explicit user approval.
Neither a complete PLAN block, a model response, nor a bare boolean grants consent.

A blocked run displays its verified plan, chapter programs and readable source
labels. GET /api/agent-runs/[runId]/plan-approval only previews the plan. Clicking
**Odobri plan i nastavi** sends the displayed revision to POST on that route.
The server checks authenticated ownership, same origin, the paused/blocked run,
the locked project and its active Pass, then stamps the owner and UTC approval
time. A stale plan returns 409 and requires another review.

The revision hashes the project, topic, work type, section outline, source
metadata, extracted plan and verified planning artifact identifiers/attempts.
Approval is stored in the existing private context manifest, never shared state
or logs. Every context upload generates a fresh contextRevision in its body and
manifest and clears consent. Approval writes only the manifest; a concurrent
context upload cannot be overwritten by an older approval. Readers require the
body and manifest revisions to match, with scope and expiry checks. A mismatched
or legacy manifest requires re-uploading context before reviewing the plan again.
No new object, table or database schema is needed.

Before calling a provider for writing, citation, review or export, the worker
requires a current approval in every run mode, including bounded autonomous
mode. This guard applies even when the external service is optional/unconfigured;
it blocks without provider usage. Each non-plan executor uses exactly the checked
manuscript and planning-result snapshot, preventing a delayed context upload from
substituting an unapproved plan between the check and the provider call. Existing source, policy, billing and quality
checks remain in force. The service checks the server-supplied approval record
and its run/project/revision binding before conversion or non-plan gates.
A plan-stage gate may run before consent. Already-approved plans do not display
another approval action just because a later content/source gate blocked.

## Local service contract check

Start the companion service on localhost with its test token
local-approval-fixture. Set KATEDRA_GATE_E2E_URL to that local HTTP URL and
KATEDRA_GATE_E2E_FIXTURE to the service checkout's
service/tests/fixture_manuscript.json, then run:

    npx vitest run --config scripts/agent-gate-service-vitest.config.ts

This opt-in check refuses non-local URLs. It uses the real app client and HTTP
service, validates the normalized app manuscript fixture, proves a complete plan
alone is blocked, exercises the actual writing gate with explicit consent, and
proves changed plan scope invalidates consent. It does not substitute for the
canonical staging release gate or activate production flags.
