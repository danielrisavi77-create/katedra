import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createAdminClient: vi.fn(), resolveOwnedProjectResult: vi.fn(), resolveCanonicalProjectPass: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({ resolveOwnedProjectResult: mocks.resolveOwnedProjectResult }))
vi.mock('@/lib/product/server-capabilities', () => ({ resolveCanonicalProjectPass: mocks.resolveCanonicalProjectPass }))
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs() })
const userId = '11111111-1111-4111-8111-111111111111'
const projectId = '22222222-2222-4222-8222-222222222222'
const manifestId = '33333333-3333-4333-8333-333333333333'
function fixture({ rejectAllocation = false, uncertainUpload = false, uncertainCompletion = false } = {}) {
  vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'true')
  vi.stubEnv('KATEDRA_RATE_LIMIT_STORE', 'memory')
  const events = []
  const now = Date.now()
  const rpc = vi.fn(async (name, args) => {
    events.push(name)
    if (name === 'reserve_material_payload') return rejectAllocation ? { error: { code: '42501' } } : { data: [{
      manifest_id: manifestId, storage_path: `${userId}/${projectId}/${args.p_material_id}-body`,
      manifest_path: `${userId}/${projectId}/${args.p_material_id}.manifest.json`,
      created_at: new Date(now).toISOString(), expires_at: new Date(now + 72 * 60 * 60 * 1000).toISOString(), consent_at: new Date(now).toISOString(),
    }] }
    if (name === 'begin_agent_payload_upload') return { data: uncertainUpload ? 'uncertain' : 'upload' }
    if (name === 'finish_agent_payload_upload') return { data: 'uploaded' }
    if (name === 'complete_material_payload') return uncertainCompletion ? { error: { code: 'network' } } : { data: manifestId }
    return { error: { code: 'unexpected_rpc' } }
  })
  const upload = vi.fn(async () => { events.push('upload'); return { error: null } })
  const remove = vi.fn(async () => ({ error: null }))
  const db = { rpc, storage: { from: () => ({ upload, remove }) }, auth: { getUser: async () => ({ data: { user: { id: userId } } }) } }
  mocks.createClient.mockResolvedValue(db)
  mocks.createAdminClient.mockReturnValue(db)
  mocks.resolveOwnedProjectResult.mockResolvedValue({ ok: true, value: { projectId } })
  mocks.resolveCanonicalProjectPass.mockResolvedValue({ allowed: true })
  const form = new FormData()
  form.set('projectId', projectId)
  form.set('kind', 'notes')
  form.set('file', new File(['private notes'], 'notes.txt', { type: 'text/plain' }))
  const request = new Request('http://localhost/api/materials', { method: 'POST', headers: { 'x-katedra-material-consent': 'material-storage-v1' }, body: form })
  return { request, events, rpc, upload, remove }
}
describe('material upload custody', () => {
  it('allocates before bytes and publishes only after both tracked uploads', async () => {
    const f = fixture(); const { POST } = await import('./route')
    const response = await POST(f.request)
    expect(response.status).toBe(200)
    expect(f.events[0]).toBe('reserve_material_payload')
    expect(f.events.filter(event => event === 'upload')).toHaveLength(2)
    expect(f.events.at(-1)).toBe('complete_material_payload')
    expect(f.upload.mock.calls[0][2]).toMatchObject({ contentType: 'text/plain', upsert: false })
    expect(f.upload.mock.calls[1][2]).toMatchObject({ contentType: 'application/json', upsert: false })
    expect((await response.json()).manifestId).toBe(manifestId)
    expect(f.remove).not.toHaveBeenCalled()
  })
  it('sends no bytes when canonical allocation is refused', async () => {
    const f = fixture({ rejectAllocation: true }); const { POST } = await import('./route')
    expect((await POST(f.request)).status).toBe(503)
    expect(f.upload).not.toHaveBeenCalled()
  })
  it.each(['uncertainUpload', 'uncertainCompletion'])('preserves evidence after %s', async failure => {
    const f = fixture({ [failure]: true }); const { POST } = await import('./route')
    expect((await POST(f.request)).status).toBe(503)
    expect(f.remove).not.toHaveBeenCalled()
    if (failure === 'uncertainUpload') expect(f.upload).not.toHaveBeenCalled()
  })
})
