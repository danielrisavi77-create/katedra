import { describe, expect, it, vi } from 'vitest'

import { loadActiveRunManuscriptContext } from './run-context-access'
import { runContextStoragePaths, MAX_AGENT_CONTEXT_BYTES } from './run-context'
import { createSupabaseRunPayloadManifestStore } from './run-context-loader'

const scope = { userId: 'user-1', projectId: 'project-1', runId: 'run-1', bucket: 'bucket', now: Date.parse('2026-09-07T12:00:00Z') }
const paths = runContextStoragePaths(scope.userId, scope.projectId, scope.runId)
const active = {
  materialId: 'run-context', projectId: scope.projectId, runId: scope.runId,
  storageBucket: scope.bucket, ...paths, expiresAt: '2026-09-08T12:00:00Z',
}
const descriptor = {
  schemaVersion: 1, kind: 'run-context', materialId: 'run-context',
  projectId: scope.projectId, runId: scope.runId, storagePath: paths.storagePath,
  expiresAt: active.expiresAt,
}
const manuscript = {
  schemaVersion: 1, projectId: scope.projectId, title: 'Test', workType: 's', activeSectionId: 'intro',
  sections: [{ id: 'intro', title: 'Intro', kind: 'chapter', order: 0, status: 'draft', content: { type: 'doc', content: [] }, updatedAt: '2026-09-07T12:00:00Z' }],
  sources: [], meta: {}, createdAt: '2026-09-07T12:00:00Z', updatedAt: '2026-09-07T12:00:00Z',
}

function storageFor(manifest: unknown = descriptor, body = JSON.stringify({ manuscript })) {
  return { download: vi.fn(async (path: string) => path === paths.manifestPath ? JSON.stringify(manifest) : body) }
}

describe('active run manuscript access', () => {
  it('projects expiry from the canonical query while excluding tombstoned rows', async () => {
    const result = Promise.resolve({ data: [{
      material_id: active.materialId, project_id: active.projectId, run_id: active.runId,
      storage_bucket: active.storageBucket, storage_path: active.storagePath,
      manifest_path: active.manifestPath, expires_at: active.expiresAt,
    }], error: null })
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query), is: vi.fn(() => query), then: result.then.bind(result),
    }
    const from = vi.fn(() => query)
    const store = createSupabaseRunPayloadManifestStore({ from })
    await expect(store.list(scope.runId, scope.projectId)).resolves.toEqual([active])
    expect(from).toHaveBeenCalledWith('agent_payload_manifests')
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('expires_at'))
    expect(query.eq.mock.calls).toEqual([['run_id', scope.runId], ['project_id', scope.projectId]])
    expect(query.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('reads an active canonical manifest and its bounded descriptor before manuscript bytes', async () => {
    const manifests = { list: vi.fn(async () => [active]) }
    const storage = storageFor()
    await expect(loadActiveRunManuscriptContext(manifests, storage, scope)).resolves.toEqual(manuscript)
    expect(manifests.list).toHaveBeenCalledWith(scope.runId, scope.projectId)
    expect(storage.download.mock.calls).toEqual([[paths.manifestPath], [paths.storagePath]])
  })

  it.each([
    [],
    [active, active],
    [{ ...active, expiresAt: '2026-09-07T12:00:00Z' }],
    [{ ...active, expiresAt: undefined }],
    [{ ...active, storageBucket: 'foreign' }],
    [{ ...active, projectId: 'foreign' }],
    [{ ...active, runId: 'foreign' }],
    [{ ...active, storagePath: 'user-2/project-1/run-1/manuscript-context.json' }],
  ])('rejects absent, ambiguous, expired or foreign canonical authority before downloading (%j)', async (...entries) => {
    const storage = storageFor()
    await expect(loadActiveRunManuscriptContext({ list: async () => entries }, storage, scope)).rejects.toThrow()
    expect(storage.download).not.toHaveBeenCalled()
  })

  it.each([
    null,
    { ...descriptor, schemaVersion: 2 },
    { ...descriptor, kind: 'notes' },
    { ...descriptor, materialId: 'foreign' },
    { ...descriptor, runId: 'foreign' },
    { ...descriptor, projectId: 'foreign' },
    { ...descriptor, storagePath: 'foreign' },
    { ...descriptor, expiresAt: 'invalid' },
    { ...descriptor, expiresAt: '2026-09-07T12:00:00Z' },
    { ...descriptor, padding: 'x'.repeat(1_048_576) },
  ])('rejects an invalid private descriptor before reading manuscript bytes (case %#)', async (manifest) => {
    const storage = storageFor(manifest)
    await expect(loadActiveRunManuscriptContext({ list: async () => [active] }, storage, scope)).rejects.toThrow()
    expect(storage.download.mock.calls).toEqual([[paths.manifestPath]])
  })

  it('retains the existing manuscript size limit after checking authority', async () => {
    const storage = storageFor(descriptor, ' '.repeat(MAX_AGENT_CONTEXT_BYTES + 1))
    await expect(loadActiveRunManuscriptContext({ list: async () => [active] }, storage, scope)).rejects.toThrow('prevelik')
  })

  it('does not fall back to retained bytes when the canonical lookup fails', async () => {
    const storage = storageFor()
    await expect(loadActiveRunManuscriptContext({ list: async () => { throw new Error('unavailable') } }, storage, scope)).rejects.toThrow()
    expect(storage.download).not.toHaveBeenCalled()
  })
})
