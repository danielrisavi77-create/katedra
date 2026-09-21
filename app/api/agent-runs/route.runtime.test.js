import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolveOwnedProjectResult: vi.fn(),
  readProjectLock: vi.fn(),
  validateLockedProjectMutation: vi.fn(),
  resolveCanonicalProjectPass: vi.fn(),
  resolveProjectCapability: vi.fn(),
  cleanupStaleInitializingAgentRun: vi.fn(),
  createAgentRun: vi.fn(),
  parseAgentRunRequest: vi.fn(),
  validateAgentRunContext: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({ resolveOwnedProjectResult: mocks.resolveOwnedProjectResult }))
vi.mock('@/lib/academic-suite/project-lock', () => ({
  readProjectLock: mocks.readProjectLock,
  validateLockedProjectMutation: mocks.validateLockedProjectMutation,
}))
vi.mock('@/lib/product/server-capabilities', () => ({
  resolveCanonicalProjectPass: mocks.resolveCanonicalProjectPass,
  resolveProjectCapability: mocks.resolveProjectCapability,
}))
vi.mock('@/lib/agents/backend-contract', () => ({
  cleanupStaleInitializingAgentRun: mocks.cleanupStaleInitializingAgentRun,
  createAgentRun: mocks.createAgentRun,
  replaceAgentPayloadsForRun: vi.fn(),
  activateAgentRun: vi.fn(),
  cancelAgentRun: vi.fn(),
}))
vi.mock('@/lib/agents/run-request', () => ({
  parseAgentRunRequest: mocks.parseAgentRunRequest,
  validateAgentRunSectionSelection: vi.fn(() => ({ ok: true, value: [] })),
}))
vi.mock('@/lib/agents/run-context', () => ({ validateAgentRunContext: mocks.validateAgentRunContext }))
vi.mock('@/lib/agents/run-context-storage', () => ({ storeAgentRunContext: vi.fn() }))
vi.mock('@/lib/deployment/agentic-availability', () => ({
  isAgenticWorkspaceAvailable: vi.fn(() => true),
  isAgentWebResearchAvailable: vi.fn(() => false),
}))

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('POST /api/agent-runs canonical Pass boundary', () => {
  it('rejects an admin-style override before create_agent_run when the exact Pass is missing', async () => {
    vi.stubEnv('KATEDRA_AGENT_RUNS_ENABLED', 'true')
    const project = { projectId: 'project-1', guestProjectId: 'project-1' }
    const lock = {
      userId: 'user-1',
      projectId: 'project-1',
      topic: 'Zaključana tema',
      workType: 'zavrsni',
      productKey: 'zavrsni',
      paymentId: 'payment-1',
      lockedAt: '2026-08-15T10:00:00.000Z',
      status: 'locked',
    }
    const manuscript = {
      schemaVersion: 1,
      projectId: 'project-1',
      title: 'Zaključana tema',
      workType: 'z',
      activeSectionId: 'intro',
      sections: [],
      sources: [],
      meta: {},
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: '2026-08-15T10:00:00.000Z',
    }
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(() => ({
        select() { return this },
        eq() { return this },
        order() { return this },
        async maybeSingle() { return { data: null, error: null } },
      })),
    })
    mocks.resolveOwnedProjectResult.mockResolvedValue({ ok: true, value: project })
    mocks.resolveCanonicalProjectPass.mockResolvedValue({ allowed: false, code: 'pass_required', projectId: 'project-1' })
    mocks.readProjectLock.mockResolvedValue({ ok: true, lock })
    mocks.validateLockedProjectMutation.mockReturnValue({ ok: true })
    mocks.parseAgentRunRequest.mockReturnValue({ ok: true, value: { mode: 'guided', sourcePolicy: 'uploaded_only', manuscript } })
    mocks.validateAgentRunContext.mockReturnValue({ ok: true, manuscript })

    const { POST } = await import('./route')
    const response = await POST(new Request('http://localhost/api/agent-runs?projectId=project-1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'guided', sourcePolicy: 'uploaded_only', manuscript }),
    }))

    expect(response.status).toBe(402)
    expect(mocks.resolveCanonicalProjectPass).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1', projectId: 'project-1' })
    expect(mocks.createAgentRun).not.toHaveBeenCalled()
  })

  it('rejects unavailable web research before creating a run', async () => {
    vi.stubEnv('KATEDRA_AGENT_RUNS_ENABLED', 'true')
    const project = { projectId: 'project-1', guestProjectId: 'project-1' }
    const lock = {
      userId: 'user-1',
      projectId: 'project-1',
      topic: 'Zaključana tema',
      workType: 'zavrsni',
      productKey: 'zavrsni',
      paymentId: 'payment-1',
      lockedAt: '2026-08-15T10:00:00.000Z',
      status: 'locked',
    }
    const manuscript = {
      schemaVersion: 1,
      projectId: 'project-1',
      title: 'Zaključana tema',
      workType: 'z',
      activeSectionId: 'intro',
      sections: [],
      sources: [],
      meta: {},
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: '2026-08-15T10:00:00.000Z',
    }
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(() => ({
        select() { return this },
        eq() { return this },
        order() { return this },
        async maybeSingle() { return { data: null, error: null } },
      })),
    })
    mocks.resolveOwnedProjectResult.mockResolvedValue({ ok: true, value: project })
    mocks.resolveCanonicalProjectPass.mockResolvedValue({ allowed: true, projectId: 'project-1', productKey: 'zavrsni' })
    mocks.readProjectLock.mockResolvedValue({ ok: true, lock })
    mocks.validateLockedProjectMutation.mockReturnValue({ ok: true })
    mocks.parseAgentRunRequest.mockReturnValue({ ok: true, value: { mode: 'guided', sourcePolicy: 'web_research', manuscript } })
    mocks.validateAgentRunContext.mockReturnValue({ ok: true, manuscript })

    const { POST } = await import('./route')
    const response = await POST(new Request('http://localhost/api/agent-runs?projectId=project-1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'guided', sourcePolicy: 'web_research', manuscript }),
    }))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Web istraživački workflow još nije dostupan.' })
    expect(mocks.createAgentRun).not.toHaveBeenCalled()
  })
})
