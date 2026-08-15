import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  resolveOwnedProject: vi.fn(),
  lookupActiveProjectPass: vi.fn(),
  ensureFreeStarterGrant: vi.fn(),
  authorizeProjectAiRequest: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({ resolveOwnedProject: mocks.resolveOwnedProject }))
vi.mock('@/lib/academic-suite/repositories/entitlements', () => ({ lookupActiveProjectPass: mocks.lookupActiveProjectPass }))
vi.mock('@/lib/katedra-free-starter', () => ({ ensureFreeStarterGrant: mocks.ensureFreeStarterGrant }))
vi.mock('@/lib/ai/project-access', () => ({ authorizeProjectAiRequest: mocks.authorizeProjectAiRequest }))

import { GET } from './route'

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('GET /api/balance entitlement errors', () => {
  it('fails closed in production when project billing contracts are not enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'legacy')
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })

    const response = await GET(new Request('http://localhost/api/balance?projectId=project-1'))

    expect(response.status).toBe(503)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('fails closed before granting a free starter when Pass lookup is unavailable', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1', guestProjectId: 'guest-1' })
    mocks.lookupActiveProjectPass.mockResolvedValue({ ok: false, error: 'entitlements unavailable' })

    const response = await GET(new Request('http://localhost/api/balance?projectId=project-1'))

    expect(response.status).toBe(503)
    expect(mocks.ensureFreeStarterGrant).not.toHaveBeenCalled()
    expect(mocks.authorizeProjectAiRequest).not.toHaveBeenCalled()
  })
})
