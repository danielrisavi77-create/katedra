# Original agent response recovery

Requires the canonical Lekta0114 execution contract. This change does not enable
agent flags, deploy a schema from Katedra, or activate a scheduler.

Before a provider or passage-verifier call, claim an immutable identity binding
the request to user, project, run, approved context revision, step, attempt,
provider, model and actual input hash. Only the canonical start transition
authorizes an external call. It checks the exact PostgreSQL step lease timestamp;
the consumer must not truncate its microseconds through a JavaScript Date.

The original unverified answer is stored privately, with a descriptor and
immutable hash, size, actual usage, original charge and pricing version. Both
uploads must be confirmed before settlement. Replays check current consent and
project access through Lekta, download bounded hash-checked bytes and reuse the
original value and charge. They never regenerate under a consumed request ID.
Expiry/withdrawal uses existing canonical temporary custody, at most72hours.

An uncertain start or a provider response lost before durable evidence remains
unresolved. Missing usage is not estimated. Upload ambiguity waits for canonical
upload reconciliation; content is never overwritten to make a retry succeed.

Worker reconciliation errors leave the same attempt available after lease expiry,
without storing an empty failed placeholder or terminally completing the run.
The same rule applies to uncertain final-result storage. Independent verification
still runs on replay. If final bytes already exist, they can be reused only when
the fresh result agrees on all content, scope, usage and verification findings;
only verification observation timestamps may differ. Canonical upload intents
must confirm the original bytes. Changed findings remain unresolved for review.

The worker route passes result storage as a worker dependency and freezes one
context snapshot for approval and execution. AgentResultV1 and output parsing,
manuscript authority and the Lekta DOCX contract are unchanged.

Tests exercise ambiguous start, response recording, upload, publication,
settlement and completion; competing calls; deleted/corrupt response; withdrawal;
original pricing; passage replay; fresh verification timestamps and changed
findings. Database/Storage fixtures do not prove an authenticated paid staging
journey. That requires the deployed canonical contract and configured staging
account/provider/verifier, followed by a separate activation decision.
