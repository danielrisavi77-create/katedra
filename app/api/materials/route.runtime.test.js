import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  resolveOwnedProject: vi.fn(),
  resolveProjectCapability: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({ resolveOwnedProject: mocks.resolveOwnedProject }))
vi.mock('@/lib/product/server-capabilities', () => ({ resolveProjectCapability: mocks.resolveProjectCapability }))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('GET /api/materials manifest integrity', () => {
  it('returns only manifests matching the requested project and storage id', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    const { GET } = await import('./route')
    const storage = {
      list: vi.fn().mockResolvedValue({
        data: [{ name: 'material-1.manifest.json' }, { name: 'material-2.manifest.json' }],
        error: null,
      }),
      download: vi.fn(async (path) => ({
        data: new Blob([JSON.stringify(path.includes('material-1')
          ? { id: 'material-1', projectId: 'project-1', name: 'Upute', expiresAt: '2099-01-01T00:00:00.000Z' }
          : { id: 'material-2', projectId: 'project-other', name: 'Tuđi sadržaj', expiresAt: '2099-01-01T00:00:00.000Z' })]),
        error: null,
      })),
    }
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      storage: { from: vi.fn(() => storage) },
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1' })
    mocks.resolveProjectCapability.mockResolvedValue({ allowed: true })

    const response = await GET(new Request('http://localhost/api/materials?projectId=project-1'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      materials: [{ id: 'material-1', projectId: 'project-1' }],
    })
  })
})
