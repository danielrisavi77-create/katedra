import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  resolveOwnedProject: vi.fn(),
  resolveOwnedProjectResult: vi.fn(async (...args) => ({ ok: true, value: await mocks.resolveOwnedProject(...args) })),
  resolveCanonicalProjectPass: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({ resolveOwnedProject: mocks.resolveOwnedProject, resolveOwnedProjectResult: mocks.resolveOwnedProjectResult }))
vi.mock('@/lib/product/server-capabilities', () => ({ resolveCanonicalProjectPass: mocks.resolveCanonicalProjectPass }))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

beforeEach(() => {
  mocks.resolveOwnedProjectResult.mockImplementation(async (...args) => ({ ok: true, value: await mocks.resolveOwnedProject(...args) }))
})

describe('GET /api/materials manifest integrity', () => {
  it('returns a controlled 503 when the distributed admin client is unavailable', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_RATE_LIMIT_STORE', 'supabase')
    const { POST } = await import('./route')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })
    mocks.createAdminClient.mockImplementation(() => { throw new Error('missing service role') })

    const response = await POST(new Request('http://localhost/api/materials', { method: 'POST' }))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Ograničavanje upload zahtjeva trenutno nije dostupno.' })
  })

  it('marks unauthenticated material responses as private and non-cacheable', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    const { GET } = await import('./route')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const response = await GET(new Request('http://localhost/api/materials?projectId=project-1'))

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('returns only manifests matching the requested project and storage id', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    const { GET } = await import('./route')
    const storage = {
      download: vi.fn(async (path) => ({
        data: new Blob([JSON.stringify(path.includes('material-1')
          ? { id: 'material-1', projectId: 'project-1', name: 'Upute', extractedText: 'privatni tekst', expiresAt: '2099-01-01T00:00:00.000Z' }
          : { id: 'material-2', projectId: 'project-other', name: 'Tuđi sadržaj', expiresAt: '2099-01-01T00:00:00.000Z' })]),
        error: null,
      })),
    }
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        material_id: 'material-1',
        storage_bucket: 'katedra-temporary-materials',
        manifest_path: 'user-1/project-1/material-1.manifest.json',
        expires_at: '2099-01-01T00:00:00.000Z',
      }],
      error: null,
    })
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      rpc,
      storage: { from: vi.fn(() => storage) },
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1' })
    mocks.resolveCanonicalProjectPass.mockResolvedValue({ allowed: true })

    const response = await GET(new Request('http://localhost/api/materials?projectId=project-1'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(rpc).toHaveBeenCalledWith('list_active_agent_payloads', {
      p_user_id: 'user-1', p_project_id: 'project-1',
    })
    const body = await response.json()
    expect(body).toMatchObject({
      materials: [{ id: 'material-1', projectId: 'project-1' }],
    })
    expect(body.materials[0].extractedText).toBeUndefined()
    expect(storage.download).toHaveBeenCalledWith('user-1/project-1/material-1.manifest.json')
  })

  it('fails closed when the canonical active-material list is unexpectedly large', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    const { GET } = await import('./route')
    const rpc = vi.fn().mockResolvedValue({ data: Array.from({ length: 101 }, (_, index) => ({ material_id: `material-${index}`, storage_bucket: 'katedra-temporary-materials', manifest_path: `user-1/project-1/material-${index}.manifest.json` })), error: null })
    const download = vi.fn()
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      rpc,
      storage: { from: vi.fn(() => ({ download })) },
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1' })
    mocks.resolveCanonicalProjectPass.mockResolvedValue({ allowed: true })

    const response = await GET(new Request('http://localhost/api/materials?projectId=project-1'))

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({ error: 'Popis materijala je prevelik za sigurno učitavanje.' })
    expect(download).not.toHaveBeenCalled()
  })

  it('does not parse an oversized storage manifest', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    const { GET } = await import('./route')
    const rpc = vi.fn().mockResolvedValue({
      data: [{ material_id: 'material-1', storage_bucket: 'katedra-temporary-materials', manifest_path: 'user-1/project-1/material-1.manifest.json' }],
      error: null,
    })
    const download = vi.fn().mockResolvedValue({ data: new Blob(['x'.repeat(1_048_577)]), error: null })
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      rpc,
      storage: { from: vi.fn(() => ({ download })) },
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1' })
    mocks.resolveCanonicalProjectPass.mockResolvedValue({ allowed: true })

    const response = await GET(new Request('http://localhost/api/materials?projectId=project-1'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    await expect(response.json()).resolves.toEqual({ materials: [] })
  })

  it('does not list a canonical material after its storage manifest is still present but tombstoned', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    const { GET } = await import('./route')
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    const list = vi.fn()
    const download = vi.fn()
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      rpc,
      storage: { from: vi.fn(() => ({ list, download })) },
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1' })
    mocks.resolveCanonicalProjectPass.mockResolvedValue({ allowed: true })

    const response = await GET(new Request('http://localhost/api/materials?projectId=project-1'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    await expect(response.json()).resolves.toEqual({ materials: [] })
    expect(list).not.toHaveBeenCalled()
    expect(download).not.toHaveBeenCalled()
  })

  it('does not download a canonical manifest from an unexpected storage path', async () => {
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
    const { GET } = await import('./route')
    const download = vi.fn()
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        material_id: 'material-1',
        storage_bucket: 'katedra-temporary-materials',
        manifest_path: 'user-1/project-1/other-project/material-1.manifest.json',
      }],
      error: null,
    })
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      rpc,
      storage: { from: vi.fn(() => ({ download })) },
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1' })
    mocks.resolveCanonicalProjectPass.mockResolvedValue({ allowed: true })

    const response = await GET(new Request('http://localhost/api/materials?projectId=project-1'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ materials: [] })
    expect(download).not.toHaveBeenCalled()
  })
})
