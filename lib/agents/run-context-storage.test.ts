import { describe, expect, it, vi } from 'vitest'
import { storeAgentRunContext, storePlanApproval } from './run-context-storage'

const input = { userId: 'user-1', projectId: 'project-1', runId: 'run-1', contextRevision: '11111111-1111-4111-8111-111111111111',
  planApproval: { schemaVersion: 1 as const, approvedBy: 'user-1', runId: 'run-1', projectId: 'project-1', planRevision: 'a'.repeat(64), approvedAt: new Date().toISOString() } }
function fixture() {
  const upload = vi.fn()
  const download = vi.fn()
  const remove = vi.fn()
  const rpc = vi.fn().mockResolvedValue({ data: input.planApproval, error: null })
  return { rpc, upload, download, remove, db: { rpc, storage: { from: () => ({ upload, download, remove }) } } }
}

describe('canonical context approval storage', () => {
  it('stores explicit approval against the revision without rewriting private objects', async () => {
    const f = fixture()
    expect(await storePlanApproval(f.db, input)).toEqual({ ok: true })
    expect(f.rpc).toHaveBeenCalledWith('approve_agent_run_context_plan', {
      p_user_id: input.userId, p_project_id: input.projectId, p_run_id: input.runId,
      p_context_revision: input.contextRevision, p_plan_revision: input.planApproval.planRevision, p_approve: true,
    })
    expect(f.upload).not.toHaveBeenCalled()
    expect(f.download).not.toHaveBeenCalled()
    expect(f.remove).not.toHaveBeenCalled()
  })
  it('rejects delayed approval when the canonical revision has changed', async () => {
    const f = fixture()
    f.rpc.mockResolvedValue({ data: null, error: { code: '40901' } })
    expect(await storePlanApproval(f.db, input)).toMatchObject({ ok: false, status: 409 })
    expect(f.upload).not.toHaveBeenCalled()
  })
  it('does not report approval after an unavailable or malformed canonical response', async () => {
    const f = fixture()
    f.rpc.mockResolvedValueOnce({ data: { ...input.planApproval, approvedBy: 'other' }, error: null }).mockRejectedValueOnce(new Error('network'))
    expect(await storePlanApproval(f.db, input)).toMatchObject({ ok: false, status: 503 })
    expect(await storePlanApproval(f.db, input)).toMatchObject({ ok: false, status: 503 })
  })
  it('rejects invalid manuscripts before reserving any temporary storage', async () => {
    const f = fixture()
    expect(await storeAgentRunContext(f.db, { ...input, manuscript: {} })).toMatchObject({ ok: false, status: 403 })
    expect(f.rpc).not.toHaveBeenCalled()
  })
})
