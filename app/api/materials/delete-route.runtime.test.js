import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolveOwnedProject: vi.fn(),
  resolveProjectCapability: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({ resolveOwnedProject: mocks.resolveOwnedProject }))
vi.mock('@/lib/product/server-capabilities', () => ({ resolveProjectCapability: mocks.resolveProjectCapability }))

afterEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe('DELETE /api/materials/:materialId canonical deletion guard', () => {
  it('fails closed before touching storage when the Lekta tombstone contract is unavailable', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    const { DELETE } = await import('./[materialId]/route')
    const storageFrom = vi.fn()
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      storage: { from: storageFrom },
    })

    const response = await DELETE(
      new Request('http://localhost/api/materials/material-1?projectId=project-1', { method: 'DELETE' }),
      { params: Promise.resolve({ materialId: '11111111-1111-4111-8111-111111111111' }) },
    )

    expect(response.status).toBe(503)
    expect(storageFrom).not.toHaveBeenCalled()
    expect(mocks.resolveOwnedProject).not.toHaveBeenCalled()
  })
})
