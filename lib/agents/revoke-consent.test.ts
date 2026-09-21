import { describe, expect, it, vi } from 'vitest'
import { revokeRunConsent } from './revoke-consent'

const scope = { userId: 'user-1', projectId: 'project-1', runId: 'run-1' }
const row = { manifest_id: 'manifest-1', storage_bucket: 'katedra-temporary-materials', storage_path: 'user-1/project-1/run-1/results/step-1.json', manifest_path: 'user-1/project-1/run-1/results/step-1.manifest.json' }
function fixture(rows = [row]) {
  let requested = false
  const rpc = vi.fn(async () => { const data = requested ? [] : rows; requested = true; return { data, error: null } })
  const remove = vi.fn().mockResolvedValue({ error: null })
  const finalize = vi.fn().mockResolvedValue({ data: [{ deleted: rows.length }], error: null })
  const ready = vi.fn().mockResolvedValue({ data: rows, error: null })
  const admin = vi.fn(() => ({ rpc: (name: string, params: unknown) => name === 'agent_payload_deletion_ready' ? ready(params) : finalize(name, params), storage: { from: vi.fn(() => ({ remove })) } }))
  return { rpc, remove, finalize, admin, ready }
}
describe('run consent withdrawal and physical deletion', () => {
  it('also cleans canonical materials attached to the revoked run', async () => {
    const materialId = '11111111-1111-4111-8111-111111111111'
    const material = { ...row, storage_path: `user-1/project-1/${materialId}-body`, manifest_path: `user-1/project-1/${materialId}.manifest.json` }
    const f = fixture([material])
    expect(await revokeRunConsent({ rpc: f.rpc }, scope, f.admin)).toEqual({ ok: true, cleanup: 'deleted' })
    expect(f.remove).toHaveBeenCalledWith([material.storage_path, material.manifest_path])
  })
  it('retains in-flight uploads without calling Storage.remove', async () => {
    const f = fixture(); f.ready.mockResolvedValue({ data: [], error: null })
    expect(await revokeRunConsent({ rpc: f.rpc }, scope, f.admin)).toEqual({ ok: true, cleanup: 'pending' })
    expect(f.remove).not.toHaveBeenCalled(); expect(f.finalize).not.toHaveBeenCalled()
  })
  it('revokes first, removes both private objects, then acknowledges only those manifests', async () => {
    const f = fixture()
    expect(await revokeRunConsent({ rpc: f.rpc }, scope, f.admin)).toEqual({ ok: true, cleanup: 'deleted' })
    expect(f.rpc).toHaveBeenCalledWith('revoke_agent_run_consent', { p_user_id: 'user-1', p_project_id: 'project-1', p_run_id: 'run-1' })
    expect(f.remove).toHaveBeenCalledWith([row.storage_path, row.manifest_path])
    expect(f.rpc.mock.invocationCallOrder[0]).toBeLessThan(f.remove.mock.invocationCallOrder[0])
    expect(f.remove.mock.invocationCallOrder[0]).toBeLessThan(f.finalize.mock.invocationCallOrder[0])
    expect(f.finalize).toHaveBeenCalledWith('finalize_agent_run_payload_deletion', { p_user_id: 'user-1', p_project_id: 'project-1', p_run_id: 'run-1', p_manifest_ids: ['manifest-1'] })
  })
  it('never touches Storage when the atomic revocation fails', async () => {
    const f = fixture(); f.rpc.mockResolvedValue({ data: [], error: { code: '42501' } })
    expect(await revokeRunConsent({ rpc: f.rpc }, scope, f.admin)).toEqual({ ok: false })
    expect(f.admin).not.toHaveBeenCalled()
  })
  it.each(['remove', 'admin', 'finalize'])('keeps deletion queued after %s failure', async failure => {
    const f = fixture()
    if (failure === 'remove') f.remove.mockRejectedValue(new Error('offline'))
    if (failure === 'admin') f.admin.mockImplementation(() => { throw new Error('unavailable') })
    if (failure === 'finalize') f.finalize.mockResolvedValue({ error: {} })
    expect(await revokeRunConsent({ rpc: f.rpc }, scope, f.admin)).toEqual({ ok: true, cleanup: 'pending' })
    if (failure !== 'finalize') expect(f.finalize).not.toHaveBeenCalled()
  })
  it.each(['other/project-1/run-1/results/a.json', 'user-1/project-1/run-2/results/a.json', 'user-1/project-1/run-1/../a.json'])('refuses privileged deletion outside canonical run paths: %s', async storage_path => {
    const f = fixture([{ ...row, storage_path }])
    expect(await revokeRunConsent({ rpc: f.rpc }, scope, f.admin)).toEqual({ ok: true, cleanup: 'pending' })
    expect(f.remove).not.toHaveBeenCalled(); expect(f.finalize).not.toHaveBeenCalled()
  })
  it('does not require service credentials for already deleted content', async () => {
    const f = fixture([])
    expect(await revokeRunConsent({ rpc: f.rpc }, scope, f.admin)).toEqual({ ok: true, cleanup: 'deleted' })
    expect(f.admin).not.toHaveBeenCalled()
  })
})
