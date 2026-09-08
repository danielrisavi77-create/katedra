import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  resolveOwnedProject: vi.fn(),
  resolveOwnedProjectResult: vi.fn(async (...args) => ({ ok: true, value: await mocks.resolveOwnedProject(...args) })),
  resolveProjectCapability: vi.fn(),
  revokeRunConsent: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/agents/revoke-consent', () => ({ revokeRunConsent: mocks.revokeRunConsent }))
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

const canonicalManifestId = '22222222-2222-4222-8222-222222222222'
function cleanupClient(remove, ready = true) {
  const rpc = vi.fn(async name => ({ data: name === 'agent_payload_deletion_ready'
    ? (ready ? [{ manifest_id: canonicalManifestId }] : []) : [{ deleted: 1 }], error: null }))
  const result = Promise.resolve({ data: { content_deleted_at: ready ? new Date().toISOString() : null }, error: null })
  const query = { select: () => query, eq: () => query, maybeSingle: () => result }
  mocks.createAdminClient.mockReturnValue({ rpc, from: () => query, storage: { from: () => ({ remove }) } })
  return rpc
}

describe('DELETE /api/materials/:materialId canonical deletion guard', () => {
  it.each(['deleted', 'pending'])('cleans all revoked dependent run copies and reports %s truthfully', async cleanup => {
    const materialId = '11111111-1111-4111-8111-111111111111'
    const runId = '33333333-3333-4333-8333-333333333333'
    const earlierRunId = '44444444-4444-4444-8444-444444444444'
    const rpc = vi.fn().mockResolvedValue({ data: [{ material_id: materialId, manifest_id: canonicalManifestId,
      storage_bucket: 'katedra-temporary-materials', storage_path: `user-1/project-1/${materialId}-body`,
      manifest_path: `user-1/project-1/${materialId}.manifest.json`, run_id: null, revoked_run_ids: [earlierRunId, runId] }] })
    cleanupClient(vi.fn().mockResolvedValue({ error: null }))
    const db = { auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) }, rpc }
    mocks.createClient.mockResolvedValue(db)
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1' })
    mocks.revokeRunConsent.mockResolvedValue({ ok: true, cleanup })
    const { DELETE } = await import('./[materialId]/route')
    const response = await DELETE(new Request(`http://localhost/api/materials/${materialId}?projectId=project-1`, { method: 'DELETE' }), { params: Promise.resolve({ materialId }) })
    expect(response.status).toBe(cleanup === 'deleted' ? 200 : 202)
    expect(await response.json()).toMatchObject({ cleanup, runConsentRevoked: true })
    expect(mocks.revokeRunConsent).toHaveBeenCalledWith(db, { userId: 'user-1', projectId: 'project-1', runId }, mocks.createAdminClient)
    expect(mocks.revokeRunConsent).toHaveBeenCalledWith(db, { userId: 'user-1', projectId: 'project-1', runId: earlierRunId }, mocks.createAdminClient)
    expect(rpc).toHaveBeenCalledWith('withdraw_material_payload_consent', expect.any(Object))
  })
  it('fails closed before touching storage when the Lekta tombstone contract is unavailable', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    const { DELETE } = await import('./[materialId]/route')
    const storageFrom = vi.fn()
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      storage: { from: storageFrom },
      rpc: vi.fn().mockResolvedValue({ error: { code: 'PGRST202' } }),
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1' })

    const response = await DELETE(
      new Request('http://localhost/api/materials/material-1?projectId=project-1', { method: 'DELETE' }),
      { params: Promise.resolve({ materialId: '11111111-1111-4111-8111-111111111111' }) },
    )

    expect(response.status).toBe(503)
    expect(storageFrom).not.toHaveBeenCalled()
  })

  it('tombstones the canonical manifest before removing its private objects', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT', 'v1')
    const materialId = '11111111-1111-4111-8111-111111111111'
    const remove = vi.fn().mockResolvedValue({ error: null })
    const cleanupRpc = cleanupClient(remove)
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        material_id: materialId, revoked_run_ids: [],
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
    expect(rpc).toHaveBeenCalledWith('withdraw_material_payload_consent', {
      p_user_id: 'user-1', p_project_id: 'project-1', p_material_id: materialId,
    })
    expect(remove).toHaveBeenCalledWith([
      `user-1/project-1/${materialId}-upute.pdf`,
      `user-1/project-1/${materialId}.manifest.json`,
    ])
    expect(cleanupRpc).toHaveBeenCalledWith('finalize_agent_payload_deletions', { p_manifest_ids: [canonicalManifestId] })
  })

  it('ne dopušta canonical RPC-u brisanje putanje izvan user/project namespacea', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT', 'v1')
    const materialId = '11111111-1111-4111-8111-111111111111'
    const remove = vi.fn().mockResolvedValue({ error: null })
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        material_id: materialId, revoked_run_ids: [],
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
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'false')
    vi.stubEnv('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT', '')
    const materialId = '11111111-1111-4111-8111-111111111111'
    const remove = vi.fn().mockResolvedValue({ error: null })
    cleanupClient(remove)
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        material_id: materialId, revoked_run_ids: [],
        manifest_id: canonicalManifestId,
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

  it('reports pending without removing bytes while an upload is uncertain', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_MATERIAL_DELETE_RPC_CONTRACT', 'v1')
    const materialId = '11111111-1111-4111-8111-111111111111'
    const remove = vi.fn().mockResolvedValue({ error: null })
    const cleanupRpc = cleanupClient(remove, false)
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1' })
    mocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
      rpc: vi.fn().mockResolvedValue({ data: [{ material_id: materialId, revoked_run_ids: [], manifest_id: canonicalManifestId,
        storage_bucket: 'katedra-temporary-materials', storage_path: `user-1/project-1/${materialId}-body`,
        manifest_path: `user-1/project-1/${materialId}.manifest.json` }] }),
      storage: { from: () => ({ remove }) },
    })
    const { DELETE } = await import('./[materialId]/route')
    const response = await DELETE(new Request(`http://localhost/api/materials/${materialId}?projectId=project-1`, { method: 'DELETE' }), { params: Promise.resolve({ materialId }) })
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ cleanup: 'pending' })
    expect(remove).not.toHaveBeenCalled()
    expect(cleanupRpc).toHaveBeenCalledTimes(1)
  })
})
