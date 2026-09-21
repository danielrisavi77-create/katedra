import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  readProjectLock: vi.fn(),
  lookupActiveProjectPassForProduct: vi.fn(),
  resumeAgentRun: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/academic-suite/project-lock', () => ({ readProjectLock: mocks.readProjectLock }))
vi.mock('@/lib/academic-suite/repositories/entitlements', () => ({ lookupActiveProjectPassForProduct: mocks.lookupActiveProjectPassForProduct }))
vi.mock('@/lib/agents/backend-contract', () => ({ resumeAgentRun: mocks.resumeAgentRun }))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('POST /api/agent-runs/:runId/resume entitlement guard', () => {
  it('does not resume a run after its locked project Pass becomes inactive', async () => {
    vi.stubEnv('KATEDRA_AGENT_RUNS_ENABLED', 'true')
    const { POST } = await import('./[runId]/resume/route')
    const query = {
      select() { return query },
      eq() { return query },
      async maybeSingle() { return { data: { run_id: 'run-1', project_id: 'project-1', status: 'paused' }, error: null } },
    }
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(() => query),
    })
    mocks.readProjectLock.mockResolvedValue({ ok: true, lock: { userId: 'user-1', projectId: 'project-1', topic: 'Tema', workType: 'zavrsni', productKey: 'zavrsni', paymentId: 'payment-1', lockedAt: '2026-08-14T10:00:00.000Z', status: 'locked' } })
    mocks.lookupActiveProjectPassForProduct.mockResolvedValue({ ok: true, active: false })
    mocks.resumeAgentRun.mockResolvedValue({ ok: true, value: { runId: 'run-1', status: 'running' } })

    const response = await POST(new Request('http://localhost/api/agent-runs/run-1/resume', { method: 'POST' }), { params: { runId: 'run-1' } })

    expect(response.status).toBe(402)
    expect(mocks.resumeAgentRun).not.toHaveBeenCalled()
  })
})
