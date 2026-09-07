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

The supplied service currently interprets planApproved as student approval,
while this client computes structural completeness from verified artifacts.
Reconcile that service meaning with explicit student approval before activation;
this integration does not enable the service or change app confirmation gates.
