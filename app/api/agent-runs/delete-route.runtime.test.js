import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createAdminClient: vi.fn(), revokeRunConsent: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/agents/revoke-consent', () => ({ revokeRunConsent: mocks.revokeRunConsent }))
import { DELETE } from './[runId]/route'
let query, user, run
const params = { params: Promise.resolve({ runId: 'run-1' }) }
const request = (project = 'project-1', origin = 'http://localhost') => new Request(`http://localhost/api/agent-runs/run-1?projectId=${project}`, { method: 'DELETE', headers: { origin } })
beforeEach(() => {
  vi.stubEnv('KATEDRA_AGENT_RUNS_ENABLED', 'false')
  user = { id: 'user-1' }; run = { run_id: 'run-1', project_id: 'project-1' }
  query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: vi.fn(async () => ({ data: run, error: null })) }
  mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user } }) }, from: () => query })
  mocks.revokeRunConsent.mockResolvedValue({ ok: true, cleanup: 'deleted' })
})
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs() })
describe('run deletion withdraws consent', () => {
  it('allows an authenticated owner to withdraw while feature activation is disabled', async () => {
    const response = await DELETE(request(), params)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ consentRevoked: true, cleanup: 'deleted' })
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mocks.revokeRunConsent).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1', projectId: 'project-1', runId: 'run-1' }, mocks.createAdminClient)
  })
  it('returns 202 without claiming physical deletion when cleanup remains queued', async () => {
    mocks.revokeRunConsent.mockResolvedValue({ ok: true, cleanup: 'pending' })
    const response = await DELETE(request(), params)
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ consentRevoked: true, cleanup: 'pending' })
  })
  it.each(['anonymous', 'foreign', 'project', 'origin'])('rejects %s without mutation', async scenario => {
    if (scenario === 'anonymous') user = null
    if (scenario === 'foreign') run = null
    const response = await DELETE(request(scenario === 'project' ? 'other' : 'project-1', scenario === 'origin' ? 'https://other.example' : 'http://localhost'), params)
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(mocks.revokeRunConsent).not.toHaveBeenCalled()
  })
})
