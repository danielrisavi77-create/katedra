import { describe, expect, it, vi } from 'vitest'

import { deleteAgentRunPayloads, deleteUserAgentPayloads } from './run-payload-deletion'

describe('agent run payload deletion', () => {
  it('removes both content and manifests, then records deletion evidence', async () => {
    const remove = vi.fn(async () => ({ error: null }))
    const rpc = vi.fn(async (name: string) => {
      if (name === 'request_agent_run_payload_deletion') {
        return {
          data: [
            { manifest_id: 'm-1', storage_bucket: 'bucket', storage_path: 'user-1/project-1/run-1/manuscript-context.json', manifest_path: 'user-1/project-1/run-1/manuscript-context.manifest.json' },
            { manifest_id: 'm-2', storage_bucket: 'bucket', storage_path: 'user-1/project-1/run-1/results/a.json', manifest_path: 'user-1/project-1/run-1/results/a.manifest.json' },
          ], error: null,
        }
      }
      return { data: [{ deleted: 2 }], error: null }
    })

    const result = await deleteAgentRunPayloads({ rpc, storage: { from: () => ({ remove }) } }, {
      userId: 'user-1', projectId: 'project-1', runId: 'run-1', now: '2026-08-22T10:00:00.000Z',
    })

    expect(result).toMatchObject({ ok: true, deleted: 2 })
    expect(remove).toHaveBeenCalledWith([
      'user-1/project-1/run-1/manuscript-context.json',
      'user-1/project-1/run-1/manuscript-context.manifest.json',
      'user-1/project-1/run-1/results/a.json',
      'user-1/project-1/run-1/results/a.manifest.json',
    ])
    expect(rpc).toHaveBeenLastCalledWith('finalize_agent_run_payload_deletion', {
      p_user_id: 'user-1', p_project_id: 'project-1', p_run_id: 'run-1', p_manifest_ids: ['m-1', 'm-2'],
    })
  })

  it('does not claim deletion complete when storage removal fails', async () => {
    const rpc = vi.fn(async (name: string) => name === 'request_agent_run_payload_deletion'
      ? { data: [{ manifest_id: 'm-1', storage_bucket: 'bucket', storage_path: 'user-1/project-1/run-1/context.json', manifest_path: 'user-1/project-1/run-1/context.manifest.json' }], error: null }
      : { data: null, error: null })
    const result = await deleteAgentRunPayloads({ rpc, storage: { from: () => ({ remove: async () => ({ error: { message: 'storage unavailable' } }) }) } }, {
      userId: 'user-1', projectId: 'project-1', runId: 'run-1',
    })

    expect(result).toMatchObject({ ok: false, status: 'deletion_scheduled' })
    expect(rpc).toHaveBeenLastCalledWith('record_agent_run_payload_deletion_failure', expect.objectContaining({
      p_user_id: 'user-1', p_project_id: 'project-1', p_run_id: 'run-1',
    }))
  })

  it('fails closed on a path outside the user/project namespace', async () => {
    const remove = vi.fn()
    const rpc = vi.fn(async () => ({
      data: [{ manifest_id: 'm-1', storage_bucket: 'bucket', storage_path: 'other-user/project-1/run-1/raw', manifest_path: 'other-user/project-1/run-1/manifest' }], error: null,
    }))
    const result = await deleteAgentRunPayloads({ rpc, storage: { from: () => ({ remove }) } }, {
      userId: 'user-1', projectId: 'project-1', runId: 'run-1',
    })

    expect(result).toMatchObject({ ok: false, status: 'contract_error' })
    expect(remove).not.toHaveBeenCalled()
  })

  it('deletes all account payload objects before account identity removal', async () => {
    const remove = vi.fn(async () => ({ error: null }))
    const rpc = vi.fn(async (name: string) => name === 'request_user_agent_payload_deletion'
      ? { data: [
        { manifest_id: 'm-1', storage_bucket: 'katedra-temporary-materials', storage_path: 'user-1/project-1/a', manifest_path: 'user-1/project-1/a.manifest' },
        { manifest_id: 'm-2', storage_bucket: 'katedra-temporary-materials', storage_path: 'user-1/project-2/b', manifest_path: 'user-1/project-2/b.manifest' },
      ], error: null }
      : { data: [{ deleted: 2 }], error: null })
    const db = { rpc, storage: { from: () => ({ remove }) } }

    await expect(deleteUserAgentPayloads(db, { userId: 'user-1' })).resolves.toEqual({ ok: true, deleted: 2, status: 'deleted' })
    expect(remove).toHaveBeenCalledWith([
      'user-1/project-1/a', 'user-1/project-1/a.manifest',
      'user-1/project-2/b', 'user-1/project-2/b.manifest',
    ])
    expect(rpc).toHaveBeenLastCalledWith('finalize_user_agent_payload_deletion', {
      p_user_id: 'user-1', p_manifest_ids: ['m-1', 'm-2'],
    })
  })

  it('blocks account deletion when account payload storage cannot be removed', async () => {
    const rpc = vi.fn(async (name: string) => name === 'request_user_agent_payload_deletion'
      ? { data: [{ manifest_id: 'm-1', storage_bucket: 'katedra-temporary-materials', storage_path: 'user-1/project-1/a', manifest_path: 'user-1/project-1/a.manifest' }], error: null }
      : { data: null, error: null })
    const db = { rpc, storage: { from: () => ({ remove: vi.fn(async () => ({ error: { message: 'offline' } })) }) } }

    await expect(deleteUserAgentPayloads(db, { userId: 'user-1' })).resolves.toMatchObject({ ok: false, status: 'deletion_scheduled' })
    expect(rpc).toHaveBeenLastCalledWith('record_user_agent_payload_deletion_failure', {
      p_user_id: 'user-1', p_error_code: 'storage_delete_failed',
    })
  })
})
