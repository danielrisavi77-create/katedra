import { describe, expect, it, vi } from 'vitest'

import { storeAgentRunContext } from './run-context-storage'

const manuscript = {
  schemaVersion: 1 as const,
  projectId: 'project-1',
  title: 'Rad',
  workType: 's' as const,
  activeSectionId: 'intro',
  sections: [{ id: 'intro', title: 'Uvod', kind: 'chapter' as const, order: 0, status: 'draft' as const, content: { type: 'doc' as const, content: [{ type: 'paragraph' as const }] }, updatedAt: '2026-08-14T10:00:00.000Z' }],
  sources: [],
  meta: {},
  createdAt: '2026-08-14T10:00:00.000Z',
  updatedAt: '2026-08-14T10:00:00.000Z',
}

describe('run context storage', () => {
  it('stores only the sanitized manuscript and registers metadata without text', async () => {
    const upload = vi.fn(async (_path: string, _body: Uint8Array, _options: { contentType: string; cacheControl: string; upsert: boolean }) => ({ error: null }))
    const remove = vi.fn(async (_paths: string[]) => ({ error: null }))
    const rpc = vi.fn(async () => ({ data: [{ manifest_id: 'manifest-1' }], error: null }))
    const db = { rpc, storage: { from: vi.fn(() => ({ upload, remove })) } }

    const result = await storeAgentRunContext(db, {
      userId: 'user-1',
      projectId: 'project-1',
      runId: 'run-1',
      manuscript,
      now: () => Date.parse('2026-08-14T10:00:00.000Z'),
    })

    expect(result).toMatchObject({ ok: true, value: { manifestId: 'manifest-1' } })
    expect(upload).toHaveBeenCalledTimes(2)
    const contextBody = upload.mock.calls[0][1]
    expect(new TextDecoder().decode(contextBody)).toContain('"manuscript"')
    expect(new TextDecoder().decode(upload.mock.calls[1][1])).not.toContain('Uvod')
    expect(rpc).toHaveBeenCalledWith('register_agent_payload', expect.objectContaining({
      p_storage_path: 'user-1/project-1/run-1/manuscript-context.json',
      p_manifest_path: 'user-1/project-1/run-1/manuscript-context.manifest.json',
    }))
  })

  it('removes both private objects when canonical registration fails', async () => {
    const upload = vi.fn(async (_path: string, _body: Uint8Array, _options: { contentType: string; cacheControl: string; upsert: boolean }) => ({ error: null }))
    const remove = vi.fn(async (_paths: string[]) => ({ error: null }))
    const db = {
      rpc: vi.fn(async () => ({ data: null, error: { message: 'register failed' } })),
      storage: { from: vi.fn(() => ({ upload, remove })) },
    }

    const result = await storeAgentRunContext(db, { userId: 'user-1', projectId: 'project-1', runId: 'run-1', manuscript })

    expect(result).toMatchObject({ ok: false, status: 503 })
    expect(remove).toHaveBeenCalledWith([
      'user-1/project-1/run-1/manuscript-context.json',
      'user-1/project-1/run-1/manuscript-context.manifest.json',
    ])
  })
})
