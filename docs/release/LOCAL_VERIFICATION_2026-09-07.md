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

## Workspace checkpoint — completed before midnight

- `npm run typecheck`, `typecheck:strict`, `lint`, `build`: exit 0.
- `npm run test:ci`: 206 files passed, 4 skipped; **965 tests passed, 4 skipped**.
- All three existing production-build browser scripts passed on port 3020.
- A separate temporary Vite/Chromium harness exercised actual Tiptap insertion,
  schema-normalized link content, stale rejection, section switching, local
  reload, purchase consent reset and nested legal-dialog focus. It exposed the
  destroyed-editor transition regression before the guard fix; its final result
  was `REAL_TIPTAP_AND_PURCHASE_COMPONENT_BROWSER_PASS`. This was component
  integration with synthetic state, not authenticated Next/API evidence.

## Policy, replay and local-ledger checkpoint — 2026-09-08

Branch head after this checkpoint: `5c92445`.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | Passed |
| `npm run typecheck:strict` | 0 | Passed, including new policy/projection/ledger boundaries |
| `npm run lint` | 0 | No errors or warnings |
| `npm run test:ci` | 0 | **210 files passed, 4 skipped; 1017 tests passed, 4 skipped** |
| `npm run build` | 0 | Production build completed |
| `node scripts/pisi-workspace-ui-e2e.mjs` | 0 | `PISI_WORKSPACE_BROWSER_E2E_PASS`; now also downloads actual History JSON and verifies synthetic private fields are excluded |
| `node scripts/hybrid-mentor-ui-e2e.mjs` | 0 | `HYBRID_MENTOR_UI_BROWSER_E2E_PASS`; authenticated journey explicitly blocked |
| `node scripts/agent-studio-ui-smoke.mjs` | 0 | `AGENT_STUDIO_UI_SMOKE_PASS` |

The ledger browser check seeds synthetic local metadata. Its successful export
does not prove authenticated chat/provider execution. The local lifecycle unit
test additionally reproduces a transient completion-write failure and verifies
that a subsequent cancel cannot relabel the actual completed response.

At the preceding dependency/preflight checkpoint, dependency audit exited 0
with 28 moderate advisories. Production, agentic and release preflights each
exited 1 because required configuration/canonical/staging evidence was absent.
No secrets or flags were supplied to manufacture a pass. Final audit, secret
scan, GitHub CI and any later changes still require their own verification.

## Final implementation checkpoint — 2026-09-08

Implementation head: `f411cca`. Typecheck, scoped strict check and lint exit 0;
lint has no warnings. Full suite: **212 files passed, 4 skipped; 1033 tests passed,
4 skipped**, 74.17 seconds. Production build exits 0. The three production-build
browser scripts again report `PISI_WORKSPACE_BROWSER_E2E_PASS`,
`HYBRID_MENTOR_UI_BROWSER_E2E_PASS` and `AGENT_STUDIO_UI_SMOKE_PASS` on port 3020.
Hybrid explicitly keeps the authenticated journey blocked externally.

Dependency audit exits 0 with 28 moderate advisories. Redacted gitleaks scans
the 20 implementation commits and reports no leaks. Root checkout's 164 status
entries equal the original captured state. Production/agentic/release preflights
each exit 1 on absent configuration and canonical/authenticated release evidence.

The [final report](OVERNIGHT_HARDENING_2026-09-08.md) records the changed-file
inventory, commit list, limitations and next five actions. GitHub checks apply
to the PR's exact head; local evidence does not replace them.
