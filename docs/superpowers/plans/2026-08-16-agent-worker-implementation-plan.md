# Agent worker sustav Katedre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Omogućiti da zaključani Katedra agenticni run sigurno nastavi rad nakon zatvaranja browsera kroz Lekta dispatcher i privatni Katedra worker endpoint.

**Architecture:** Lekta Edge Function ostaje scheduler/dispatcher i koristi samo service-role ključ prema canonical Supabase bazi. Katedra privatni endpoint izvršava točno jedan korak, učitava privatni kontekst, poziva provider kroz billing sloj, verificira rezultat i poziva completion RPC. Postojeći `claim_agent_step` lease i `complete_agent_step` ostaju jedini canonical lifecycle mehanizam.

**Tech Stack:** Next.js 16, Node.js route runtime, Supabase Edge Functions/Deno, Supabase RPC, TypeScript, Vitest, existing Anthropic provider adapter, existing Katedra billing and observability helpers.

## Global Constraints

- `KATEDRA_AGENT_RUNS_ENABLED` i `KATEDRA_PROJECT_LOCKS_ENABLED` moraju biti `true` prije obrade bilo kojeg koraka.
- Worker prihvaća samo konfigurirani `KATEDRA_AGENT_WORKER_TOKEN`.
- Lekta dispatcher prihvaća samo `KATEDRA_AGENT_WORKER_CRON_SECRET` kroz `Authorization: Bearer`.
- `claim_agent_step` je jedini način preuzimanja koraka.
- Jedan korak ima samo jedan aktivni lease; canonical lease traje pet minuta.
- Provider timeout je 150 sekundi, a dispatcher callback timeout 180 sekundi.
- Jedan dispatcher tick obrađuje sekvencijalno početno 4, najviše 10 runova.
- Pokušaji su ograničeni na `1`, `2` i `3`; treći popravljivi neuspjeh prelazi u `blocked`.
- Billing ishod je uvijek `settled`, `released` ili `pending_reconciliation`.
- Rezultat se sprema kao privatni payload; shared run state dobiva samo manifest pointer i verifikacijski sažetak.
- Worker ne logira prompt, rukopis, upload, source passages, AI output, tokene ili tajne.
- Terminalni runovi (`completed`, `blocked`, `failed`, `cancelled`) ne dobivaju nove claimove.
- Nema nove queue infrastrukture, paralelne obrade poglavlja ni nove Katedrine database migracije u ovoj iteraciji.
- Feature flagovi ostaju isključeni dok staging contract i authenticated E2E ne prođu.

---

## Task 1: Izolirati i ojačati Lekta dispatcher

**Files:**
- Create: `Lekta/supabase/functions/katedra-agent-worker/dispatcher.ts`
- Modify: `Lekta/supabase/functions/katedra-agent-worker/index.ts`
- Modify: `Lekta/tests/agent-worker-dispatcher.test.ts`

**Interfaces:**
- Produces `dispatchAgentRuns(runs, options): Promise<DispatchBatchResult>`.
- `DispatchBatchResult` sadrži `results: Array<{ runId: string; status: number }>` i `failed: number`.
- `DispatchOptions` sadrži `appUrl`, `workerToken`, `timeoutMs`, `fetchImpl` i `maxRuns`.

- [ ] **Step 1: Write the failing tests**

Dodaj testove koji importaju pure dispatcher helper i dokazuju:

```ts
it('dispatches runs sequentially with the worker token and no service-role header', async () => {
  const calls: string[] = []
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push(`${url}:${init?.headers instanceof Headers ? init.headers.get('x-katedra-agent-worker-token') : ''}`)
    return new Response('{}', { status: 200 })
  }

  const result = await dispatchAgentRuns(
    [{ run_id: 'run-1' }, { run_id: 'run-2' }],
    { appUrl: 'https://katedra.test', workerToken: 'worker-secret', timeoutMs: 180_000, fetchImpl },
  )

  expect(result).toEqual({ results: [{ runId: 'run-1', status: 200 }, { runId: 'run-2', status: 200 }], failed: 0 })
  expect(calls).toEqual([
    'https://katedra.test/api/internal/agent-worker:worker-secret',
    'https://katedra.test/api/internal/agent-worker:worker-secret',
  ])
})

it('maps callback timeout and 5xx to failed dispatch results', async () => {
  const fetchImpl = async () => new Response('{}', { status: 503 })
  await expect(dispatchAgentRuns([{ run_id: 'run-1' }], {
    appUrl: 'https://katedra.test', workerToken: 'worker-secret', timeoutMs: 180_000, fetchImpl,
  })).resolves.toMatchObject({ failed: 1, results: [{ runId: 'run-1', status: 503 }] })
})

it('rejects invalid run identifiers and caps the batch at ten', async () => {
  const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
  const runs = Array.from({ length: 12 }, (_, index) => ({ run_id: `run-${index}` }))
  await dispatchAgentRuns(runs, { appUrl: 'https://katedra.test', workerToken: 'worker-secret', timeoutMs: 180_000, fetchImpl, maxRuns: 12 })
  expect(fetchImpl).toHaveBeenCalledTimes(10)
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
Set-Location D:\katedra-master\Lekta
npm.cmd exec vitest run tests/agent-worker-dispatcher.test.ts --reporter=dot
```

Expected: FAIL because `dispatcher.ts` and `dispatchAgentRuns` do not yet exist.

- [ ] **Step 3: Implement the minimal dispatcher helper**

Implement sequential dispatch with these rules:

```ts
const DEFAULT_BATCH = 4
const MAX_BATCH = 10

export async function dispatchAgentRuns(runs, options) {
  const limit = Math.min(MAX_BATCH, Math.max(1, Math.trunc(options.maxRuns ?? DEFAULT_BATCH)))
  const results = []
  for (const run of runs.slice(0, limit)) {
    const runId = typeof run.run_id === 'string' ? run.run_id.trim() : ''
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(runId)) continue
    try {
      const response = await fetchWithTimeout(options.fetchImpl, `${options.appUrl}/api/internal/agent-worker`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-katedra-agent-worker-token': options.workerToken },
        body: JSON.stringify({ runId }),
      }, options.timeoutMs)
      results.push({ runId, status: response.status })
    } catch {
      results.push({ runId, status: 599 })
    }
  }
  return { results, failed: results.filter((item) => item.status >= 500).length }
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
```

The helper must use an `AbortController` timeout and must never add
`Authorization: Bearer ${SERVICE_ROLE_KEY}` or log the worker token.

- [ ] **Step 4: Wire the Edge Function to the helper**

Keep cron authorization and service-role Supabase query in `index.ts`. Parse
`KATEDRA_AGENT_WORKER_BATCH` with default `4` and cap `10`, query only:

```ts
.from('agent_runs')
.select('run_id')
.in('status', ['pending', 'running'])
.order('updated_at', { ascending: true })
.limit(batch)
```

Return `502` when `failed > 0`, otherwise `200`. Return `503` when dispatcher
configuration is missing.

- [ ] **Step 5: Run the focused tests and Lekta typecheck**

Run:

```powershell
npm.cmd exec vitest run tests/agent-worker-dispatcher.test.ts --reporter=dot
& .\node_modules\.bin\tsc.cmd --noEmit
```

Expected: all dispatcher tests pass and TypeScript exits `0`.

- [ ] **Step 6: Commit the isolated task**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add supabase/functions/katedra-agent-worker/dispatcher.ts supabase/functions/katedra-agent-worker/index.ts tests/agent-worker-dispatcher.test.ts
& 'C:\Program Files\Git\cmd\git.exe' commit -m "feat: harden agent worker dispatcher"
```

## Task 2: Ojačati Katedra worker endpoint i timeout

**Files:**
- Modify: `D:\katedra-master\app\api\internal\agent-worker\route.js`
- Create: `D:\katedra-master\app\api\internal\agent-worker\route.runtime.test.js`
- Modify: `D:\katedra-master\lib\agents\anthropic-provider.test.ts`

**Interfaces:**
- `POST /api/internal/agent-worker` nastavlja primati `{ runId }`.
- Odgovor za obrađeni korak ostaje `{ runId, status, stepsProcessed, lastStepId? }`.
- Transport/configuration greške vraćaju `503`; per-step `retrying`, `blocked` i `failed` ostaju uspješan callback s 2xx odgovorom.

- [ ] **Step 1: Write the failing runtime tests**

Dodaj testove s dependency injection seamom koji potvrđuju:

```ts
it('passes the 150 second provider timeout to the Anthropic provider', async () => {
  // configure enabled flags and fake DB/provider dependencies
  await POST(requestWithRun('run-1'))
  expect(createAnthropicAgentProvider).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 150_000 }))
})

it('returns 503 for a claim or completion transport failure', async () => {
  // fake claim RPC error; do not expose provider or payload details
  await expect(POST(requestWithRun('run-1'))).resolves.toMatchObject({ status: 503 })
})

it('returns 200 for a bounded retry result', async () => {
  // fake provider failure classified as retryable and completion RPC success
  await expect(POST(requestWithRun('run-1'))).resolves.toMatchObject({ status: 200 })
})
```

Add an Anthropic provider test proving that `timeoutMs: 150_000` is honored
without exposing the API key or request body in an error response.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
Set-Location D:\katedra-master
npm.cmd exec vitest run app/api/internal/agent-worker/route.runtime.test.js lib/agents/anthropic-provider.test.ts --reporter=dot
```

Expected: FAIL because the route does not yet expose the runtime seam/timeout contract.

- [ ] **Step 3: Implement endpoint hardening**

Use `getRequestId`/`withRequestId` for every response and log only bounded IDs,
status, attempt, provider, latency and billing state. Create the provider with:

```js
createAnthropicAgentProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: workerConfig.model,
  timeoutMs: 150_000,
})
```

Wrap DB lookup and `runAgentWorkerLoop` in a narrow `try/catch`. Map database,
storage and completion transport failures to a sanitized `503`; keep the
worker loop's bounded step result as `200`. Do not return `error.message` to the
dispatcher. Preserve constant-time token comparison and the existing flag/config
fail-closed checks.

- [ ] **Step 4: Run focused tests and root typecheck**

```powershell
npm.cmd exec vitest run app/api/internal/agent-worker/route.runtime.test.js lib/agents/anthropic-provider.test.ts --reporter=dot
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the isolated task**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add app/api/internal/agent-worker/route.js app/api/internal/agent-worker/route.runtime.test.js lib/agents/anthropic-provider.test.ts
& 'C:\Program Files\Git\cmd\git.exe' commit -m "feat: harden agent worker execution"
```

## Task 3: Zaključati lifecycle, lease i retry ponašanje testovima

**Files:**
- Modify: `D:\katedra-master\lib\agents\worker.ts`
- Modify: `D:\katedra-master\lib\agents\worker-loop.ts`
- Modify: `D:\katedra-master\lib\agents\worker.test.ts`
- Modify: `D:\katedra-master\lib\agents\worker-loop.test.ts`
- Modify: `D:\katedra-master\Lekta\tests\agentic-run-contract.test.ts`
- Modify: `D:\katedra-master\Lekta\tests\katedra-locked-project-mutation.test.ts`

**Interfaces:**
- `processClaimedAgentStep` ostaje jedini root helper za claim → execute → verify → store → complete.
- `runAgentWorkerLoop(..., { maxSteps: 1 })` obrađuje jedan korak po Katedra HTTP pozivu.
- Lekta migration contract ostaje canonical za petominutni lease i `p_requeue` attempt prijelaze.

- [ ] **Step 1: Write failing lifecycle tests**

Dodaj konkretne testove:

```ts
it('does not complete a step after the backend reports a stale lease', async () => {
  const rpc = vi.fn()
    .mockResolvedValueOnce({ data: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', step_order: 1, attempt: 1, status: 'running' }], error: null })
    .mockResolvedValueOnce({ data: null, error: { message: 'Agent step lease has expired' } })
  await expect(processClaimedAgentStep(dependencies(rpc), handlers())).resolves.toMatchObject({ status: 'failed' })
})

it('never claims a second step when maxSteps is one', async () => {
  const result = await runAgentWorkerLoop(dependencies(twoVerifiedStepsRpc()), handlers(), { maxSteps: 1 })
  expect(result.stepsProcessed).toBe(1)
})
```

Test file mora definirati lokalne fixture helper-e, bez pozivanja na produkcijski
worker:

```ts
function dependencies(rpc) {
  return { db: { rpc }, workerId: 'worker-1', runId: 'run-1' }
}

function handlers() {
  return {
    execute: vi.fn().mockResolvedValue({ output: 'Tekst', citations: [], provider: 'test', usage: { inputTokens: 1, outputTokens: 1 } }),
    verify: vi.fn().mockReturnValue({ status: 'verified', issues: [], evidence: [] }),
  }
}

function twoVerifiedStepsRpc() {
  return vi.fn()
    .mockResolvedValueOnce({ data: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', step_order: 1, attempt: 1, status: 'running' }], error: null })
    .mockResolvedValueOnce({ data: { status: 'verified' }, error: null })
    .mockResolvedValueOnce({ data: [{ step_id: 'step-2', agent: 'review', verifier: 'review_verifier', step_order: 2, attempt: 1, status: 'running' }], error: null })
    .mockResolvedValueOnce({ data: { status: 'verified' }, error: null })
}
```

Add source-contract assertions for migration `0078_harden_agent_run_lifecycle.sql`:

```ts
expect(migration).toContain("lease_expires_at = now() + interval '5 minutes'")
expect(migration).toContain("p_attempt not between 1 and 3")
expect(migration).toContain("current_step.lease_owner <> p_worker_id")
expect(migration).toContain("current_step.lease_expires_at <= now()")
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd exec vitest run lib/agents/worker.test.ts lib/agents/worker-loop.test.ts --reporter=dot
Set-Location D:\katedra-master\Lekta
npm.cmd exec vitest run tests/agentic-run-contract.test.ts tests/katedra-locked-project-mutation.test.ts --reporter=dot
```

Expected: the new stale-lease/lifecycle assertions fail before implementation.

- [ ] **Step 3: Implement only missing lifecycle behavior**

Preserve existing billing and verifier semantics. Ensure completion RPC errors
are returned as `failed` without a second completion attempt, and ensure a
`retrying` result stops the current loop so the scheduler reclaims it later.
Do not add a client-side retry loop or direct table writes.

- [ ] **Step 4: Run focused tests and the related agent suite**

```powershell
Set-Location D:\katedra-master
npm.cmd exec vitest run lib/agents/worker.test.ts lib/agents/worker-loop.test.ts lib/agents/billed-provider-execution.test.ts lib/agents/run-result-storage.test.ts --reporter=dot
Set-Location D:\katedra-master\Lekta
npm.cmd exec vitest run tests/agentic-run-contract.test.ts tests/katedra-locked-project-mutation.test.ts tests/agentic-payload-attachment.test.ts tests/agent-payload-attachment-revocation.test.ts tests/agent-payload-replacement.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 5: Commit the isolated task**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add D:\katedra-master\lib\agents\worker.ts D:\katedra-master\lib\agents\worker-loop.ts D:\katedra-master\lib\agents\worker.test.ts D:\katedra-master\lib\agents\worker-loop.test.ts
& 'C:\Program Files\Git\cmd\git.exe' commit -m "test: lock agent worker lifecycle"
```

The nested Lekta contract files remain in the nested repository and receive a
separate commit there when the task is executed.

## Task 4: Dodati dispatcher/worker integration smoke harness

**Files:**
- Modify: `D:\katedra-master\scripts\agentic-workflow-e2e.mjs`
- Modify: `D:\katedra-master\scripts\agentic-workspace-ui-e2e.mjs`
- Create: `D:\katedra-master\scripts\agent-worker-local-contract-e2e.mjs`
- Create: `D:\katedra-master\scripts\agent-worker-local-contract-e2e.test.js`
- Modify: `D:\katedra-master\package.json`

**Interfaces:**
- `npm.cmd run test:e2e:agent-worker-contract` runs a deterministic local contract smoke test.
- Authenticated staging scripts remain fail-closed and must print `BLOCKED_EXTERNAL` when credentials/contracts are absent.

- [ ] **Step 1: Write the failing harness test**

The test must verify the state machine without pretending to run staging:

```js
it('reports blocked external staging instead of claiming a successful worker run', () => {
  const output = runContractScript({ env: {} })
  expect(output).toContain('BLOCKED_EXTERNAL')
  expect(output).not.toContain('AGENTIC_WORKFLOW_PASS')
})
```

The test helper must execute the checked-in script without network credentials:

```js
const SCRIPT = join(import.meta.dirname, 'agent-worker-local-contract-e2e.mjs')
function runContractScript({ env }) {
  return execFileSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
}
```

Add a second fixture-driven case that simulates dispatcher `200`, per-step
`retrying`, next dispatcher tick, and final `completed` without real provider or
Supabase credentials.

- [ ] **Step 2: Run the harness test and verify RED**

```powershell
npm.cmd exec vitest run scripts/agent-worker-local-contract-e2e.test.js --reporter=dot
```

Expected: FAIL because the contract script does not exist.

- [ ] **Step 3: Implement the deterministic contract harness**

Keep it separate from authenticated staging E2E. It may use local pure helpers,
but it must not set production flags, fabricate a successful external checkout,
or print a false pass. Add the script to `package.json`.

- [ ] **Step 4: Run both local and external-gated scripts**

```powershell
npm.cmd run test:e2e:agent-worker-contract
npm.cmd run test:e2e:agentic
npm.cmd run test:e2e:agentic-ui
```

Expected: local contract PASS; authenticated scripts either PASS with staging
credentials or explicitly report `BLOCKED_EXTERNAL` without claiming success.

- [ ] **Step 5: Commit the isolated task**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add scripts/agent-worker-local-contract-e2e.mjs scripts/agent-worker-local-contract-e2e.test.js package.json
& 'C:\Program Files\Git\cmd\git.exe' commit -m "test: add agent worker contract smoke"
```

## Task 5: Deployment runbook, cron gate i observability contract

**Files:**
- Modify: `D:\katedra-master\docs\release\AGENTIC_STAGING_DEPLOY.md`
- Modify: `D:\katedra-master\docs\release\AGENTIC_CONTRACT_PREFLIGHT.md`
- Modify: `D:\katedra-master\docs\architecture\AGENTIC_RUN_CONTRACT.md`
- Create: `D:\katedra-master\docs\release\AGENT_WORKER_RUNBOOK.md`
- Create: `D:\katedra-master\lib\deployment\agent-worker-runbook.test.js`

**Interfaces:**
- Runbook documents deploy order, secret ownership, cron schedule, rollback and read-only checks.
- Preflight rejects missing/legacy `KATEDRA_AGENT_MODEL`, `KATEDRA_BILLING_RPC_CONTRACT`, `KATEDRA_RATE_LIMIT_STORE`, worker URL/token/cron secret and feature flags.

- [ ] **Step 1: Write documentation contract tests**

Add a Vitest/source test asserting the runbook contains:

```ts
expect(runbook).toContain('katedra-agent-worker')
expect(runbook).toContain('KATEDRA_AGENT_WORKER_CRON_SECRET')
expect(runbook).toContain('KATEDRA_AGENT_WORKER_TOKEN')
expect(runbook).toContain('cron.job_run_details')
expect(runbook).toContain('ne šalje service-role ključ')
expect(runbook).toContain('KATEDRA_AGENT_RUNS_ENABLED=true')
```

The test reads the actual runbook rather than duplicating its contents:

```js
const runbook = readFileSync(join(import.meta.dirname, '../../docs/release/AGENT_WORKER_RUNBOOK.md'), 'utf8')
```

- [ ] **Step 2: Run the documentation test and verify RED**

```powershell
npm.cmd exec vitest run lib/deployment/agent-worker-runbook.test.js --reporter=dot
```

Expected: FAIL until the new runbook/preflight assertions are present.

- [ ] **Step 3: Write the runbook**

Document this exact order:

1. apply and verify Lekta migrations 0077–0085;
2. deploy `katedra-agent-worker` with `--no-verify-jwt`;
3. set cron secret in Supabase secret store and worker token in both systems;
4. schedule a one-minute `pg_cron`/scheduler tick;
5. run read-only schema/RPC/storage checks;
6. run staging checkout → lock → context → worker → verifier → billing flow;
7. inspect `cron.job_run_details`, reconciliation and TTL cleanup;
8. only then enable the two feature flags;
9. rollback by disabling flags and leaving shared state untouched.

State explicitly that local development remains `503` when contracts are absent
and that no service-role key is sent to Katedra.

- [ ] **Step 4: Run docs/preflight tests and commit**

```powershell
npm.cmd exec vitest run lib/deployment/agent-worker-runbook.test.js lib/deployment/agentic-preflight.test.js --reporter=dot
& 'C:\Program Files\Git\cmd\git.exe' add docs/release/AGENTIC_STAGING_DEPLOY.md docs/release/AGENTIC_CONTRACT_PREFLIGHT.md docs/architecture/AGENTIC_RUN_CONTRACT.md docs/release/AGENT_WORKER_RUNBOOK.md
& 'C:\Program Files\Git\cmd\git.exe' commit -m "docs: add agent worker staging runbook"
```

## Task 6: Full quality gate and review checkpoint

**Files:**
- No new production files; review all changes from Tasks 1–5.

- [ ] **Step 1: Run root quality gates**

```powershell
Set-Location D:\katedra-master
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

- [ ] **Step 2: Run nested Lekta quality gates**

```powershell
Set-Location D:\katedra-master\Lekta
npm.cmd run check
```

If local Supabase Postgres is unavailable, record SQL lint as external/unavailable
and do not claim a database migration has been executed.

- [ ] **Step 3: Run local browser and contract checks**

```powershell
Set-Location D:\katedra-master
npm.cmd run test:e2e:pisi
npm.cmd run test:e2e:agent-studio-ui
npm.cmd run test:e2e:agent-worker-contract
npm.cmd run test:e2e:hybrid-ui
```

- [ ] **Step 4: Verify static safety properties**

```powershell
rg -n "dangerouslySetInnerHTML|innerHTML|KATEDRA_BODY_HTML" app lib scripts --glob '!**/*.test.*'
rg -n "SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY" supabase/functions/katedra-agent-worker app/api/internal/agent-worker
& 'C:\Program Files\Git\cmd\git.exe' diff --check
```

The first scan must have no production matches. The second scan may show only
Lekta-local service-role usage in the dispatcher and must show no service-role
header sent to Katedra.

- [ ] **Step 5: Review checkpoint**

Before enabling flags, review:

- worker dispatcher diff;
- Katedra endpoint diff;
- lifecycle tests and migration contract;
- runbook and preflight output;
- all external blockers.

Do not mark the feature production-ready unless authenticated staging proves
browser close/resume, duplicate dispatch, provider failure, billing
reconciliation, TTL cleanup and final Lekta handoff.
