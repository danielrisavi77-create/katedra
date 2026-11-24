import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolveOwnedProjectResult: vi.fn(),
  resolveProjectCapability: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({ resolveOwnedProjectResult: mocks.resolveOwnedProjectResult }))
vi.mock('@/lib/product/server-capabilities', () => ({ resolveProjectCapability: mocks.resolveProjectCapability }))

import { GET } from './route'

function request(projectId = 'project-1') {
  return new Request(`http://localhost:3000/api/project-capabilities?projectId=${projectId}`)
}

afterEach(() => vi.clearAllMocks())

describe('GET /api/project-capabilities', () => {
  it('rejects anonymous access', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })
    expect((await GET(request())).status).toBe(401)
  })

  it('returns both research module decisions without exposing manuscript content', async () => {
    vi.stubEnv('KATEDRA_RESEARCH_MODULES_ENABLED', 'true')
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.resolveOwnedProjectResult.mockResolvedValue({ ok: true, value: { projectId: 'canonical-project' } })
    mocks.resolveProjectCapability
      .mockResolvedValueOnce({ allowed: true, tier: 'zavrsni', projectId: 'project-1' })
      .mockResolvedValueOnce({ allowed: true, tier: 'zavrsni', projectId: 'project-1' })

    const body = await (await GET(request())).json()

    expect(body.projectId).toBe('canonical-project')
    expect(body.capabilities.researchDesign.allowed).toBe(true)
    expect(body.capabilities.methodology.allowed).toBe(true)
    expect(mocks.resolveProjectCapability).toHaveBeenNthCalledWith(1, expect.anything(), { userId: 'user-1', projectId: 'canonical-project', capability: 'research_design' })
    expect(mocks.resolveProjectCapability).toHaveBeenNthCalledWith(2, expect.anything(), { userId: 'user-1', projectId: 'canonical-project', capability: 'methodology' })
    expect(JSON.stringify(body)).not.toContain('manuscript')
  })

  it('does not disclose another user project', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.resolveOwnedProjectResult.mockResolvedValue({ ok: true, value: null })
    expect((await GET(request('other-project'))).status).toBe(404)
  })
})
