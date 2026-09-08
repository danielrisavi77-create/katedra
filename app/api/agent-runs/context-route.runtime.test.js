import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  readProjectLock: vi.fn(),
  validateLockedProjectMutation: vi.fn((lock, mutation) => mutation.topic === lock.topic ? { ok: true } : { ok: false, status: 409, error: 'Tema je zaključana.' }),
  lookupActiveProjectPass: vi.fn(),
  lookupActiveProjectPassForProduct: vi.fn(),
  storeAgentRunContext: vi.fn(),
  replaceAgentPayloadsForRun: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/academic-suite/project-lock', () => ({ readProjectLock: mocks.readProjectLock, validateLockedProjectMutation: mocks.validateLockedProjectMutation }))
vi.mock('@/lib/academic-suite/repositories/entitlements', () => ({ lookupActiveProjectPass: mocks.lookupActiveProjectPass, lookupActiveProjectPassForProduct: mocks.lookupActiveProjectPassForProduct }))
vi.mock('@/lib/agents/run-context-storage', () => ({ storeAgentRunContext: mocks.storeAgentRunContext }))
vi.mock('@/lib/agents/backend-contract', () => ({ replaceAgentPayloadsForRun: mocks.replaceAgentPayloadsForRun }))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

beforeEach(() => {
  mocks.replaceAgentPayloadsForRun.mockResolvedValue({ ok: true, value: { materialIds: [] } })
})

describe('POST /api/agent-runs/:runId/context entitlement guard', () => {
  it('rejects context updates when the locked project Pass is no longer active', async () => {
    vi.stubEnv('KATEDRA_AGENT_RUNS_ENABLED', 'true')
    const { POST } = await import('./[runId]/context/route')
    const query = {
      select() { return query },
      eq() { return query },
      async maybeSingle() { return { data: { run_id: 'run-1', project_id: 'project-1', status: 'paused' }, error: null } },
    }
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(() => query),
    })
    mocks.readProjectLock.mockResolvedValue({
      ok: true,
      lock: { userId: 'user-1', projectId: 'project-1', topic: 'Tema', workType: 'zavrsni', productKey: 'zavrsni', paymentId: 'payment-1', lockedAt: '2026-08-14T10:00:00.000Z', status: 'locked' },
    })
    mocks.lookupActiveProjectPass.mockResolvedValue({ ok: true, active: false })
    mocks.lookupActiveProjectPassForProduct.mockResolvedValue({ ok: true, active: false })
    mocks.storeAgentRunContext.mockResolvedValue({ ok: true, value: { manifestId: 'manifest-1', expiresAt: '2026-08-17T10:00:00.000Z' } })

    const response = await POST(
      new Request('http://localhost/api/agent-runs/run-1/context', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ manuscript: { projectId: 'project-1' } }),
      }),
      { params: { runId: 'run-1' } },
    )

    expect(response.status).toBe(402)
    expect(mocks.storeAgentRunContext).not.toHaveBeenCalled()
  })

  it('fails closed when the active Pass lookup is unavailable', async () => {
    vi.stubEnv('KATEDRA_AGENT_RUNS_ENABLED', 'true')
    const { POST } = await import('./[runId]/context/route')
    const query = {
      select() { return query },
      eq() { return query },
      async maybeSingle() { return { data: { run_id: 'run-1', project_id: 'project-1', status: 'paused' }, error: null } },
    }
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(() => query),
    })
    mocks.readProjectLock.mockResolvedValue({ ok: true, lock: { userId: 'user-1', projectId: 'project-1', topic: 'Rad', workType: 'zavrsni', productKey: 'zavrsni', paymentId: 'payment-1', lockedAt: '2026-08-14T10:00:00.000Z', status: 'locked' } })
    mocks.lookupActiveProjectPass.mockResolvedValue({ ok: false, error: 'entitlements unavailable' })
    mocks.lookupActiveProjectPassForProduct.mockResolvedValue({ ok: false, error: 'entitlements unavailable' })

    const response = await POST(
      new Request('http://localhost/api/agent-runs/run-1/context', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ manuscript: { projectId: 'project-1' } }),
      }),
      { params: { runId: 'run-1' } },
    )

    expect(response.status).toBe(503)
    expect(mocks.storeAgentRunContext).not.toHaveBeenCalled()
  })

  it('checks the Pass product locked to the project, not any active Katedra Pass', async () => {
    vi.stubEnv('KATEDRA_AGENT_RUNS_ENABLED', 'true')
    const { POST } = await import('./[runId]/context/route')
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
    mocks.lookupActiveProjectPass.mockResolvedValue({ ok: true, active: true })
    mocks.lookupActiveProjectPassForProduct.mockResolvedValue({ ok: true, active: false })
    mocks.storeAgentRunContext.mockResolvedValue({ ok: true, value: { manifestId: 'manifest-1', expiresAt: '2026-08-17T10:00:00.000Z' } })

    const response = await POST(
      new Request('http://localhost/api/agent-runs/run-1/context', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ manuscript: { projectId: 'project-1' } }),
      }),
      { params: { runId: 'run-1' } },
    )

    expect(response.status).toBe(402)
    expect(mocks.lookupActiveProjectPassForProduct).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1', projectId: 'project-1', productId: 'katedra_pass_zavrsni' })
    expect(mocks.storeAgentRunContext).not.toHaveBeenCalled()
  })

  it('rejects a revised context that changes the locked topic', async () => {
    vi.stubEnv('KATEDRA_AGENT_RUNS_ENABLED', 'true')
    const { POST } = await import('./[runId]/context/route')
    const query = {
      select() { return query },
      eq() { return query },
      async maybeSingle() { return { data: { run_id: 'run-1', project_id: 'project-1', status: 'paused' }, error: null } },
    }
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(() => query),
    })
    mocks.readProjectLock.mockResolvedValue({ ok: true, lock: { userId: 'user-1', projectId: 'project-1', topic: 'Zaključana tema', workType: 'zavrsni', productKey: 'zavrsni', paymentId: 'payment-1', lockedAt: '2026-08-14T10:00:00.000Z', status: 'locked' } })
    mocks.lookupActiveProjectPassForProduct.mockResolvedValue({ ok: true, active: true })
    mocks.storeAgentRunContext.mockResolvedValue({ ok: true, value: { manifestId: 'manifest-1', expiresAt: '2026-08-17T10:00:00.000Z' } })

    const manuscript = {
      schemaVersion: 1,
      projectId: 'project-1',
      title: 'Druga tema',
      workType: 'z',
      activeSectionId: 'intro',
      sections: [{ id: 'intro', title: 'Uvod', kind: 'chapter', order: 0, status: 'empty', content: { type: 'doc', content: [{ type: 'paragraph' }] }, updatedAt: '2026-08-15T10:00:00.000Z' }],
      sources: [],
      meta: {},
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: '2026-08-15T10:00:00.000Z',
    }
    const response = await POST(
      new Request('http://localhost/api/agent-runs/run-1/context', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ manuscript }),
      }),
      { params: { runId: 'run-1' } },
    )

    expect(response.status).toBe(409)
    expect(mocks.storeAgentRunContext).not.toHaveBeenCalled()
  })

  it('reports an atomic context/material commit conflict without a separate attachment', async () => {
    vi.stubEnv('KATEDRA_AGENT_RUNS_ENABLED', 'true')
    const { POST } = await import('./[runId]/context/route')
    const query = {
      select() { return query },
      eq() { return query },
      async maybeSingle() { return { data: { run_id: 'run-1', project_id: 'project-1', status: 'paused' }, error: null } },
    }
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(() => query),
    })
    mocks.readProjectLock.mockResolvedValue({ ok: true, lock: { userId: 'user-1', projectId: 'project-1', topic: 'Rad', workType: 'zavrsni', productKey: 'zavrsni', paymentId: 'payment-1', lockedAt: '2026-08-14T10:00:00.000Z', status: 'locked' } })
    mocks.lookupActiveProjectPassForProduct.mockResolvedValue({ ok: true, active: true })
    mocks.storeAgentRunContext.mockResolvedValue({ ok: false, status: 409, error: 'Material selection changed' })

    const manuscript = {
      schemaVersion: 1,
      projectId: 'project-1',
      title: 'Rad',
      workType: 'z',
      activeSectionId: 'intro',
      sections: [{ id: 'intro', title: 'Uvod', kind: 'chapter', order: 0, status: 'empty', content: { type: 'doc', content: [{ type: 'paragraph' }] }, updatedAt: '2026-08-15T10:00:00.000Z' }],
      sources: [],
      meta: {},
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: '2026-08-15T10:00:00.000Z',
    }
    const response = await POST(
      new Request('http://localhost/api/agent-runs/run-1/context', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          manuscript,
          materialIds: ['material-1', 'material-2'],
        }),
      }),
      { params: { runId: 'run-1' } },
    )

    expect(response.status).toBe(409)
    expect(mocks.replaceAgentPayloadsForRun).not.toHaveBeenCalled()
    expect(mocks.storeAgentRunContext).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ materialIds: ['material-1', 'material-2'] }), expect.any(Function))
  })

  it('can explicitly remove all previously selected input materials', async () => {
    vi.stubEnv('KATEDRA_AGENT_RUNS_ENABLED', 'true')
    const { POST } = await import('./[runId]/context/route')
    const query = {
      select() { return query },
      eq() { return query },
      async maybeSingle() { return { data: { run_id: 'run-1', project_id: 'project-1', status: 'paused' }, error: null } },
    }
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(() => query),
    })
    mocks.readProjectLock.mockResolvedValue({ ok: true, lock: { userId: 'user-1', projectId: 'project-1', topic: 'Rad', workType: 'zavrsni', productKey: 'zavrsni', paymentId: 'payment-1', lockedAt: '2026-08-14T10:00:00.000Z', status: 'locked' } })
    mocks.lookupActiveProjectPassForProduct.mockResolvedValue({ ok: true, active: true })
    mocks.storeAgentRunContext.mockResolvedValue({ ok: true, value: { manifestId: 'manifest-1', expiresAt: '2026-08-17T10:00:00.000Z' } })

    const manuscript = {
      schemaVersion: 1,
      projectId: 'project-1',
      title: 'Rad',
      workType: 'z',
      activeSectionId: 'intro',
      sections: [{ id: 'intro', title: 'Uvod', kind: 'chapter', order: 0, status: 'empty', content: { type: 'doc', content: [{ type: 'paragraph' }] }, updatedAt: '2026-08-15T10:00:00.000Z' }],
      sources: [],
      meta: {},
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: '2026-08-15T10:00:00.000Z',
    }
    const response = await POST(
      new Request('http://localhost/api/agent-runs/run-1/context', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ manuscript, materialIds: [] }),
      }),
      { params: { runId: 'run-1' } },
    )

    expect(response.status).toBe(200)
    expect(mocks.storeAgentRunContext).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'user-1', projectId: 'project-1', runId: 'run-1', materialIds: [],
    }), expect.any(Function))
    expect(mocks.storeAgentRunContext).toHaveBeenCalled()
  })
})
