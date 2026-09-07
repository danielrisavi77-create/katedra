import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createAnthropicAgentProvider: vi.fn(),
  createGatewayAgentProvider: vi.fn(),
  createProviderRouter: vi.fn(),
  createProviderBackedExecutor: vi.fn(),
  runAgentWorkerLoop: vi.fn(),
  loadRunManuscriptContext: vi.fn(),
  loadActiveRunManuscriptContext: vi.fn(),
  manifestStore: { list: vi.fn() },
  loadRunMaterialContexts: vi.fn(),
  runContextStoragePaths: vi.fn(),
  verifyAgentResult: vi.fn(),
  storeAgentStepResult: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/agents/anthropic-provider', () => ({ createAnthropicAgentProvider: mocks.createAnthropicAgentProvider }))
vi.mock('@/lib/agents/provider-gateway', () => ({ createGatewayAgentProvider: mocks.createGatewayAgentProvider }))
vi.mock('@/lib/agents/provider-router', () => ({ createProviderRouter: mocks.createProviderRouter }))
vi.mock('@/lib/agents/provider-worker', () => ({ createProviderBackedExecutor: mocks.createProviderBackedExecutor }))
vi.mock('@/lib/agents/worker-loop', () => ({ runAgentWorkerLoop: mocks.runAgentWorkerLoop }))
vi.mock('@/lib/agents/run-context-loader', () => ({
  createSupabaseRunPayloadManifestStore: () => mocks.manifestStore,
  loadRunManuscriptContext: mocks.loadRunManuscriptContext,
  loadRunMaterialContexts: mocks.loadRunMaterialContexts,
}))
vi.mock('@/lib/agents/run-context-access', () => ({ loadActiveRunManuscriptContext: mocks.loadActiveRunManuscriptContext }))
vi.mock('@/lib/agents/run-context', () => ({ runContextStoragePaths: mocks.runContextStoragePaths }))
vi.mock('@/lib/agents/verifier', () => ({ verifyAgentResult: mocks.verifyAgentResult }))
vi.mock('@/lib/agents/run-result-storage', () => ({ storeAgentStepResult: mocks.storeAgentStepResult }))

const run = {
  run_id: 'run-1',
  user_id: 'user-1',
  project_id: 'project-1',
  source_policy: 'uploaded_only',
  status: 'running',
}

function request(body = { runId: 'run-1' }) {
  return new Request('http://localhost/api/internal/agent-worker', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-katedra-agent-worker-token': 'worker-secret',
      'x-request-id': 'worker-request-1',
    },
    body: JSON.stringify(body),
  })
}

function database(runRecord = run) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    async maybeSingle() { return { data: runRecord, error: null } },
  }
  return {
    from: vi.fn(() => query),
    storage: { from: vi.fn(() => ({ download: vi.fn() })) },
  }
}

async function loadRoute() {
  vi.resetModules()
  return import('./route')
}

beforeEach(() => {
  vi.stubEnv('KATEDRA_AGENT_RUNS_ENABLED', 'true')
  vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
  vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
  vi.stubEnv('KATEDRA_AGENT_WORKER_TOKEN', 'worker-secret')
  vi.stubEnv('KATEDRA_AGENT_WORKER_CRON_SECRET', 'cron-secret')
  vi.stubEnv('KATEDRA_WORKER_APP_URL', 'https://worker.example.test')
  vi.stubEnv('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT', 'v1')
  vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
  vi.stubEnv('KATEDRA_RATE_LIMIT_STORE', 'supabase')
  vi.stubEnv('KATEDRA_AGENT_MODEL', 'claude-sonnet-5')
  vi.stubEnv('ANTHROPIC_API_KEY', 'provider-secret')
  mocks.createAdminClient.mockReturnValue(database())
  mocks.createAnthropicAgentProvider.mockReturnValue({ id: 'anthropic', capabilities: ['text'] })
  mocks.createGatewayAgentProvider.mockReturnValue({ id: 'gateway', capabilities: ['text'] })
  mocks.createProviderRouter.mockReturnValue({ providerFor: vi.fn() })
  mocks.createProviderBackedExecutor.mockReturnValue(vi.fn())
  mocks.runAgentWorkerLoop.mockResolvedValue({ status: 'retrying', stepsProcessed: 1, lastStepId: 'step-1' })
  mocks.runContextStoragePaths.mockReturnValue({ storagePath: 'user/project/run/context.json' })
  mocks.storeAgentStepResult.mockResolvedValue({ ok: true, value: { manifestId: 'manifest-1' } })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('POST /api/internal/agent-worker runtime contract', () => {
  it('loads manuscript context through canonical active-manifest authority', async () => {
    const { POST } = await loadRoute()
    await POST(request())
    const executorOptions = mocks.createProviderBackedExecutor.mock.calls[0][0]
    await executorOptions.loadContext()
    expect(mocks.loadActiveRunManuscriptContext).toHaveBeenCalledWith(
      mocks.manifestStore,
      expect.objectContaining({ download: expect.any(Function) }),
      { runId: run.run_id, projectId: run.project_id, userId: run.user_id, bucket: 'katedra-temporary-materials' },
    )
    expect(mocks.loadRunManuscriptContext).not.toHaveBeenCalled()
  })

  it('passes the 150 second provider timeout and returns the request id', async () => {
    const { POST } = await loadRoute()

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('worker-request-1')
    expect(mocks.createAnthropicAgentProvider).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'provider-secret',
      model: 'claude-sonnet-5',
      timeoutMs: 150_000,
    }))
    expect(mocks.runAgentWorkerLoop).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-1', workerId: expect.any(String) }),
      expect.objectContaining({ execute: expect.any(Function), verify: expect.any(Function), storeResult: expect.any(Function) }),
      { maxSteps: 1 },
    )
  })

  it('routes citation and review steps to a separately approved verifier gateway', async () => {
    vi.stubEnv('KATEDRA_VERIFIER_POLICY_APPROVED', 'true')
    vi.stubEnv('KATEDRA_VERIFIER_PROVIDER_URL', 'https://verifier.example.test/run')
    vi.stubEnv('KATEDRA_VERIFIER_PROVIDER_KEY', 'verifier-secret')
    vi.stubEnv('KATEDRA_VERIFIER_PROVIDER_MODEL', 'verifier-model')
    const { POST } = await loadRoute()

    await POST(request())

    expect(mocks.createGatewayAgentProvider).toHaveBeenCalledWith(expect.objectContaining({
      id: 'configured-verifier-gateway',
      endpoint: 'https://verifier.example.test/run',
      apiKey: 'verifier-secret',
      model: 'verifier-model',
      capabilities: ['text'],
      timeoutMs: 150_000,
    }))
    expect(mocks.createProviderRouter).toHaveBeenCalledWith(expect.objectContaining({
      assignments: expect.objectContaining({
        citation: 'gateway',
        review: 'gateway',
      }),
    }))
  })

  it('returns a sanitized 503 when the worker loop cannot complete the RPC contract', async () => {
    mocks.runAgentWorkerLoop.mockRejectedValue(new Error('internal provider or database detail'))
    const { POST } = await loadRoute()

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(response.headers.get('x-request-id')).toBe('worker-request-1')
    expect(body).toEqual({ error: 'Agent worker trenutno nije mogao obraditi korak.' })
    expect(JSON.stringify(body)).not.toContain('internal provider')
  })

  it('returns 200 for a bounded retry result so the next cron tick can reclaim it', async () => {
    mocks.runAgentWorkerLoop.mockResolvedValue({ status: 'retrying', stepsProcessed: 1, lastStepId: 'step-1' })
    const { POST } = await loadRoute()

    const response = await POST(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ runId: 'run-1', status: 'retrying', stepsProcessed: 1 })
  })

  it('returns 503 when the loop reports a backend completion error', async () => {
    mocks.runAgentWorkerLoop.mockResolvedValue({ status: 'failed', stepsProcessed: 1, error: 'completion rpc unavailable' })
    const { POST } = await loadRoute()

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(response.headers.get('x-request-id')).toBe('worker-request-1')
    expect(body).toEqual({ error: 'Agent worker trenutno nije mogao obraditi korak.' })
    expect(JSON.stringify(body)).not.toContain('completion rpc')
  })

  it('does not execute an initializing run before its context is activated', async () => {
    mocks.createAdminClient.mockReturnValue(database({ ...run, status: 'initializing' }))
    const { POST } = await loadRoute()

    const response = await POST(request())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ status: 'initializing', stepsProcessed: 0 })
    expect(mocks.runAgentWorkerLoop).not.toHaveBeenCalled()
  })

  it('does not construct an AI execution for a paused run', async () => {
    mocks.createAdminClient.mockReturnValue(database({ ...run, status: 'paused' }))
    const { POST } = await loadRoute()

    const response = await POST(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'paused', stepsProcessed: 0 })
    expect(mocks.createAnthropicAgentProvider).not.toHaveBeenCalled()
    expect(mocks.runAgentWorkerLoop).not.toHaveBeenCalled()
  })
})
