import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  resolveOwnedProject: vi.fn(),
  resolveOwnedProjectResult: vi.fn(async (...args) => ({ ok: true, value: await mocks.resolveOwnedProject(...args) })),
  lookupActiveProjectPass: vi.fn(),
  lookupActiveProjectPassForProduct: vi.fn(),
  readProjectLock: vi.fn(),
  ensureFreeStarterGrant: vi.fn(),
  authorizeProjectAiRequest: vi.fn(),
  isAdminOverrideUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({ resolveOwnedProject: mocks.resolveOwnedProject, resolveOwnedProjectResult: mocks.resolveOwnedProjectResult }))
vi.mock('@/lib/academic-suite/repositories/entitlements', () => ({
  lookupActiveProjectPass: mocks.lookupActiveProjectPass,
  lookupActiveProjectPassForProduct: mocks.lookupActiveProjectPassForProduct,
}))
vi.mock('@/lib/academic-suite/project-lock', () => ({ readProjectLock: mocks.readProjectLock }))
vi.mock('@/lib/katedra-free-starter', () => ({ ensureFreeStarterGrant: mocks.ensureFreeStarterGrant }))
vi.mock('@/lib/ai/project-access', () => ({ authorizeProjectAiRequest: mocks.authorizeProjectAiRequest }))
vi.mock('@/lib/auth/admin-access', () => ({ isAdminOverrideUser: mocks.isAdminOverrideUser }))

import { GET } from './route'

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

beforeEach(() => {
  mocks.resolveOwnedProjectResult.mockImplementation(async (...args) => ({ ok: true, value: await mocks.resolveOwnedProject(...args) }))
})

describe('GET /api/balance entitlement errors', () => {
  it('returns a temporary failure when the project ownership lookup is unavailable', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.resolveOwnedProjectResult.mockResolvedValue({ ok: false, error: 'projects unavailable' })

    const response = await GET(new Request('http://localhost/api/balance?projectId=project-1'))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Projekt trenutačno nije moguće provjeriti.' })
  })

  it('fails closed with a controlled response when the admin client is unavailable', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockImplementation(() => { throw new Error('missing service role') })

    const response = await GET(new Request('http://localhost/api/balance?projectId=project-1'))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Stanje AI pristupa trenutno nije dostupno.' })
  })

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
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1', guestProjectId: 'guest-1' })
    mocks.readProjectLock.mockResolvedValue({ ok: true, lock: { productKey: 'seminarski' } })
    mocks.lookupActiveProjectPassForProduct.mockResolvedValue({ ok: false, error: 'entitlements unavailable' })

    const response = await GET(new Request('http://localhost/api/balance?projectId=project-1'))

    expect(response.status).toBe(503)
    expect(mocks.ensureFreeStarterGrant).not.toHaveBeenCalled()
    expect(mocks.authorizeProjectAiRequest).not.toHaveBeenCalled()
  })

  it('does not treat a generic active Pass as valid when the locked tier has no exact entitlement', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1', guestProjectId: 'guest-1' })
    mocks.readProjectLock.mockResolvedValue({ ok: true, lock: { productKey: 'seminarski' } })
    mocks.lookupActiveProjectPass.mockResolvedValue({ ok: true, active: true })
    mocks.lookupActiveProjectPassForProduct.mockResolvedValue({ ok: true, active: false })
    mocks.authorizeProjectAiRequest.mockResolvedValue({ allowed: true, balance: 2 })

    const response = await GET(new Request('http://localhost/api/balance?projectId=project-1'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ hasPass: false, balance: 2, low: true })
    expect(mocks.lookupActiveProjectPass).not.toHaveBeenCalled()
    expect(mocks.lookupActiveProjectPassForProduct).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'user-1',
      projectId: 'project-1',
      productId: 'katedra_pass_seminarski',
    }))
  })

  it('returns an explicit admin override without querying Pass or wallet balance', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1', guestProjectId: 'guest-1' })
    mocks.isAdminOverrideUser.mockReturnValue(true)

    const response = await GET(new Request('http://localhost/api/balance?projectId=project-1'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ hasPass: false, adminOverride: true, unlimited: true, balance: null, low: false })
    expect(mocks.lookupActiveProjectPass).not.toHaveBeenCalled()
    expect(mocks.authorizeProjectAiRequest).not.toHaveBeenCalled()
  })
})
