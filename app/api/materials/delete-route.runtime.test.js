import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolveOwnedProject: vi.fn(),
  resolveOwnedProjectResult: vi.fn(async (...args) => ({ ok: true, value: await mocks.resolveOwnedProject(...args) })),
  resolveProjectCapability: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({ resolveOwnedProject: mocks.resolveOwnedProject, resolveOwnedProjectResult: mocks.resolveOwnedProjectResult }))
vi.mock('@/lib/product/server-capabilities', () => ({ resolveProjectCapability: mocks.resolveProjectCapability }))

afterEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.unstubAllEnvs()
})

beforeEach(() => {
  mocks.resolveOwnedProjectResult.mockImplementation(async (...args) => ({ ok: true, value: await mocks.resolveOwnedProject(...args) }))
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

  it('tombstones the canonical manifest before removing its private objects', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT', 'v1')
    const materialId = '11111111-1111-4111-8111-111111111111'
    const remove = vi.fn().mockResolvedValue({ error: null })
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        material_id: materialId,
        manifest_id: '22222222-2222-4222-8222-222222222222',
        storage_bucket: 'katedra-temporary-materials',
        storage_path: `user-1/project-1/${materialId}-upute.pdf`,
        manifest_path: `user-1/project-1/${materialId}.manifest.json`,
      }],
      error: null,
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1' })
    mocks.resolveProjectCapability.mockResolvedValue({ allowed: true })
    const { DELETE } = await import('./[materialId]/route')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      rpc,
      storage: { from: vi.fn().mockReturnValue({ remove }) },
    })

    const response = await DELETE(
      new Request(`http://localhost/api/materials/${materialId}?projectId=project-1`, { method: 'DELETE' }),
      { params: Promise.resolve({ materialId }) },
    )

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('tombstone_agent_payload', {
      p_user_id: 'user-1', p_project_id: 'project-1', p_material_id: materialId,
    })
    expect(remove).toHaveBeenCalledWith([
      `user-1/project-1/${materialId}-upute.pdf`,
      `user-1/project-1/${materialId}.manifest.json`,
    ])
  })

  it('ne dopušta canonical RPC-u brisanje putanje izvan user/project namespacea', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT', 'v1')
    const materialId = '11111111-1111-4111-8111-111111111111'
    const remove = vi.fn().mockResolvedValue({ error: null })
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        material_id: materialId,
        storage_bucket: 'katedra-temporary-materials',
        storage_path: `user-1/project-1/${materialId}/../file.pdf`,
        manifest_path: 'user-1/project-1/not-the-material.manifest.json',
      }],
      error: null,
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1' })
    mocks.resolveProjectCapability.mockResolvedValue({ allowed: true })
    const { DELETE } = await import('./[materialId]/route')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      rpc,
      storage: { from: vi.fn().mockReturnValue({ remove }) },
    })

    const response = await DELETE(
      new Request(`http://localhost/api/materials/${materialId}?projectId=project-1`, { method: 'DELETE' }),
      { params: Promise.resolve({ materialId }) },
    )

    expect(response.status).toBe(503)
    expect(remove).not.toHaveBeenCalled()
  })

  it('allows the owner to delete temporary material after the Pass expires', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT', 'v1')
    const materialId = '11111111-1111-4111-8111-111111111111'
    const remove = vi.fn().mockResolvedValue({ error: null })
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        material_id: materialId,
        storage_bucket: 'katedra-temporary-materials',
        storage_path: `user-1/project-1/${materialId}-upute.pdf`,
        manifest_path: `user-1/project-1/${materialId}.manifest.json`,
      }],
      error: null,
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1' })
    mocks.resolveProjectCapability.mockResolvedValue({ allowed: false, code: 'pass_required' })
    const { DELETE } = await import('./[materialId]/route')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      rpc,
      storage: { from: vi.fn().mockReturnValue({ remove }) },
    })

    const response = await DELETE(
      new Request(`http://localhost/api/materials/${materialId}?projectId=project-1`, { method: 'DELETE' }),
      { params: Promise.resolve({ materialId }) },
    )

    expect(response.status).toBe(200)
    expect(mocks.resolveProjectCapability).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalled()
  })
})
