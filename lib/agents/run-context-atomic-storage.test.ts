import { describe, expect, it, vi } from 'vitest'
import { storeAgentRunContext } from './run-context-storage'

const revision = '11111111-1111-4111-8111-111111111111'
const prefix = `user-1/project-1/run-1/contexts/${revision}`
const reservation = { manifest_id: 'manifest-1', context_revision: revision,
  storage_path: `${prefix}/manuscript-context.json`, manifest_path: `${prefix}/manuscript-context.manifest.json`,
  expires_at: '2026-09-11T10:00:00.000Z' }
const manuscript = { schemaVersion: 1, projectId: 'project-1', title: 'Rad', workType: 's', activeSectionId: 'intro',
  sections: [{ id: 'intro', title: 'Uvod', kind: 'chapter', order: 0, status: 'draft', content: { type: 'doc', content: [{ type: 'paragraph' }] }, updatedAt: '2026-09-08T10:00:00.000Z' }],
  sources: [], meta: {}, createdAt: '2026-09-08T10:00:00.000Z', updatedAt: '2026-09-08T10:00:00.000Z' }
const input = { userId: 'user-1', projectId: 'project-1', runId: 'run-1', manuscript, materialIds: ['material-1'], now: () => Date.parse('2026-09-08T10:00:00.000Z') }
function fixture() {
  const events: string[] = []
  const rpc = vi.fn(async (name: string, _params: Record<string, unknown>) => {
    events.push(name)
    return { data: name === 'reserve_agent_run_context' ? [reservation] : name === 'begin_agent_payload_upload' ? 'upload' : name === 'finish_agent_payload_upload' ? 'uploaded' : 'manifest-1', error: null as null | { message: string } }
  })
  const upload = vi.fn(async (_path: string, _body: Uint8Array, _options: unknown) => { events.push('upload'); return { error: null as null | { message: string } } })
  const remove = vi.fn()
  return { rpc, upload, remove, events, db: { rpc, storage: { from: () => ({ upload, remove }) } } }
}
describe('atomic context upload protocol', () => {
  it('sends no bytes when withdrawal wins before upload authorization', async () => {
    const f = fixture()
    f.rpc.mockImplementation(async name => ({ data: name === 'reserve_agent_run_context' ? [reservation] : null, error: name === 'begin_agent_payload_upload' ? { message: 'consent withdrawn' } : null }))
    expect(await storeAgentRunContext(f.db, input)).toMatchObject({ ok: false })
    expect(f.upload).not.toHaveBeenCalled()
  })
  it('allocates canonical paths before upload and commits materials with the context', async () => {
    const f = fixture()
    expect(await storeAgentRunContext(f.db, input)).toMatchObject({ ok: true, value: { manifestId: 'manifest-1' } })
    expect(f.events).toEqual(['reserve_agent_run_context', 'begin_agent_payload_upload', 'upload', 'finish_agent_payload_upload', 'begin_agent_payload_upload', 'upload', 'finish_agent_payload_upload', 'commit_agent_run_context'])
    expect(f.upload.mock.calls.every(call => (call[2] as { upsert: boolean }).upsert === false)).toBe(true)
    expect(f.rpc).toHaveBeenLastCalledWith('commit_agent_run_context', expect.objectContaining({ p_manifest_id: 'manifest-1', p_material_ids: ['material-1'] }))
    expect(JSON.parse(new TextDecoder().decode(f.upload.mock.calls[0][1])).contextRevision).toBe(revision)
    expect(JSON.stringify(f.rpc.mock.calls)).not.toContain('Uvod')
  })
  it('never commits a partially uploaded version', async () => {
    const f = fixture()
    f.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: 'upload failed' } })
    expect(await storeAgentRunContext(f.db, input)).toMatchObject({ ok: false })
    expect(f.rpc.mock.calls.map(call => call[0])).not.toContain('commit_agent_run_context')
    expect(f.rpc).toHaveBeenLastCalledWith('finish_agent_payload_upload', expect.objectContaining({ p_succeeded: false }))
  })
  it('does not delete objects after an ambiguous commit failure', async () => {
    const f = fixture()
    f.rpc.mockImplementation(async name => ({ data: name === 'reserve_agent_run_context' ? [reservation] : name === 'begin_agent_payload_upload' ? 'upload' : name === 'finish_agent_payload_upload' ? 'uploaded' : null, error: name === 'commit_agent_run_context' ? { message: 'connection lost after commit' } : null }))
    expect(await storeAgentRunContext(f.db, input)).toMatchObject({ ok: false, status: 503 })
    expect(f.remove).not.toHaveBeenCalled()
  })
  it('refuses paths from another scope before any upload', async () => {
    const f = fixture()
    f.rpc.mockResolvedValue({ data: [{ ...reservation, storage_path: `other/${reservation.storage_path}` }], error: null })
    expect(await storeAgentRunContext(f.db, input)).toMatchObject({ ok: false })
    expect(f.upload).not.toHaveBeenCalled()
  })
})
