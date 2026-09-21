# Server configuration boundaries

Current inventory for overnight hardening, 2026-09-07. Values and credentials are intentionally omitted.

| Boundary | Parser / consumer | Required semantics |
| --- | --- | --- |
| Agentic environment readiness | `lib/deployment/agentic-preflight.mjs` | Unknown-input typed checker; reports names only. Requires agent, lock and material flags exactly `true`, billing `v2`, distributed rate store `supabase`, material deletion `v1`, worker credentials/model, Anthropic key and approved independent verifier. Worker/verifier URLs must be HTTPS. |
| Browser availability projection | `lib/deployment/agentic-availability.ts` | Produces availability booleans, never credentials. Missing-key parity tests compare it with preflight. Availability does not approve activation. |
| Worker model and billing contracts | `lib/agents/worker-config.ts` | Typed success/failure union; rejects missing or placeholder configuration and unsupported billing/store contract versions. |
| Provider timeout | Worker/provider constructors | Existing bounded numeric timeout arguments (150 seconds for agent providers, 30 seconds for passage verification) remain unchanged. |
| Temporary bucket | Material/context/worker server callers | Existing `katedra-temporary-materials` default and explicit server overrides. Scoped canonical manifests must match the selected bucket and expected owner/project paths. |
| Production commercial services | `lib/deployment/preflight.mjs` and route checks | Existing explicit server configuration and separate release decision. This branch does not supply credentials or enable flags. |

`npm run typecheck:strict` checks cost policy, worker configuration, active run-context access and the typed staging checker (including their TypeScript dependencies). The ordinary application tsconfig remains non-strict. CI runs the additional ratchet so later edits cannot silently weaken these domains' type guarantees.

This inventory is not a claim that every environment read has been centralized. Further consolidation must preserve existing deployment names, defaults, route contracts and fail-closed behavior; do not migrate all configuration merely to reduce file count.
