# Local verification — 2026-09-07

This is local evidence for the overnight hardening branch, not deployed release approval.

## Unmodified baseline

- Base: `origin/master` at `24dfc1841f475ba31791c017d23267deaee796ff`.
- Branch: `codex/overnight-katedra-hardening`, isolated worktree.
- Main checkout's pre-existing changes remain untouched. Its starting status was recorded outside the repository; no stash/reset was performed.
- Node `v24.14.0`; npm `11.9.0`; Windows PowerShell.

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci` | 0 | Dependencies installed from lockfile; 28 moderate advisories |
| `npm run audit:dependencies` | 0 | 28 moderate advisories; no high/critical gate failure |
| `npm run typecheck` | 0 | Passed |
| `npm run lint` | 0 | Passed |
| `npm run test:ci` | 0 | 200 files passed, 4 skipped; 876 tests passed, 4 skipped |
| `npm run build` | 0 | Production build completed |
| `node scripts/pisi-workspace-ui-e2e.mjs` | 0 | `PISI_WORKSPACE_BROWSER_E2E_PASS` |
| `node scripts/hybrid-mentor-ui-e2e.mjs` | 0 | `HYBRID_MENTOR_UI_BROWSER_E2E_PASS` |
| `node scripts/agent-studio-ui-smoke.mjs` | 0 | `AGENT_STUDIO_UI_SMOKE_PASS` |

The three browser checks used the actual production build served on `http://127.0.0.1:3020`, with their documented URL environment variables. Guest browser contexts and synthetic local content do not prove authenticated access, payment, provider or canonical RPC behavior.

`hybrid-mentor-ui-e2e.mjs` explicitly reported `BLOCKED_EXTERNAL` for the authenticated checkout/webhook/worker/provider journey. Missing staging authentication, worker/provider configuration and release flags were not supplied or enabled. Its zero exit only proves its local UI assertions.

Vite emitted an existing warning about ESM syntax in `vitest.config.ts` being loaded as CommonJS. This did not fail the baseline tests. Dependency advisories were not force-fixed.

## Change verification

### First security/privacy checkpoint

| Scope | Evidence |
| --- | --- |
| Chat reservation/cache | Regression observed 2561 reserved against permitted estimates 5121 / 40961; separate cache regression observed `no-cache`. Related suite: 57 passed, 1 skipped across 7 passed files / 1 skipped file. |
| Withdrawal confirmation | Three new failing cases reproduced ignored resolved email errors/missing acceptance and ignored confirmation write errors. Related suite: 16 passed in 4 files. |
| Material bounds/MIME | Eight failing cases reproduced dropped truncated material and image substitutions. Related suite: 42 passed in 7 files. |
| Run context access | Worker wiring regression reproduced bypass of active-manifest loader. Access suite: 22 passed; related worker/material/provider suite passed before adding the final query-projection case. |
| Typecheck | `npm run typecheck`: exit 0 |
| Lint | `npm run lint`: exit 0 |
| Full suite | `npm run test:ci`: exit 0; 201 files passed, 4 skipped; 912 tests passed, 4 skipped |
| Production build | `npm run build`: exit 0 |
| Read-only review | Privacy and billing reviewers found no new concrete regressions in these changes; retained external blockers and conservative reservation tradeoff are documented. |

The baseline server also reported missing Supabase client configuration when guest UI attempted account-related requests. Browser checks still passed their guest assertions; authenticated endpoints were not verified. No credentials were copied to silence these expected configuration failures.

These are checkpoint results, not the final gate for later edits. Changed authenticated worker/storage behavior remains locally tested with synthetic adapters, not a deployed RPC/RLS proof.
