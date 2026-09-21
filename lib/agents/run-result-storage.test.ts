import { describe, expect, it, vi } from 'vitest'

import type { AgentStepRecord } from './run-state'
import type { AgentResultV1, VerificationResultV1 } from './contracts'
import { loadAgentRunResults, storeAgentStepResult } from './run-result-storage'

const step: AgentStepRecord = {
  id: 'run-1:writing:section-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'section-1', order: 4, attempt: 1, status: 'running',
}
const result: Omit<AgentResultV1, 'agent'> = {
  output: 'Novi odlomak rada.', citations: [{ id: 'source-1', url: 'https://example.test/source', verified: true }], claims: [{ id: 'claim-1', text: 'Novi odlomak rada.', citationIds: ['source-1'], support: [{ citationId: 'source-1', quote: 'Relevantan odlomak.', locator: 'p. 2' }] }], provider: 'test-provider', usage: { inputTokens: 10, outputTokens: 20 }, baseRevision: '2026-08-14T10:00:00.000Z', sectionId: 'section-1',
}
const verification: VerificationResultV1 = { status: 'verified', issues: [], evidence: [] }

describe('agent result payload storage', () => {
  it('stores the generated result privately and registers only its manifest', async () => {
    const upload = vi.fn(async (_path: string, _body: Uint8Array, _options: { contentType: string; cacheControl: string; upsert: boolean }) => ({ error: null }))
    const remove = vi.fn(async (_paths: string[]) => ({ error: null }))
    const rpc = vi.fn(async () => ({ data: [{ manifest_id: 'manifest-result-1' }], error: null }))
    const stored = await storeAgentStepResult({ rpc, storage: { from: vi.fn(() => ({ upload, remove })) } }, { userId: 'user-1', projectId: 'project-1', runId: 'run-1', step, result, verification, now: () => Date.parse('2026-08-14T10:00:00.000Z') })
    expect(stored).toMatchObject({ ok: true, value: { manifestId: 'manifest-result-1' } })
    expect(upload).toHaveBeenCalledTimes(2)
    expect(new TextDecoder().decode(upload.mock.calls[0][1])).toContain('Novi odlomak rada.')
    expect(rpc).toHaveBeenCalledWith('register_agent_payload', expect.objectContaining({ p_run_id: 'run-1', p_material_id: expect.stringMatching(/^agent-result:/), p_storage_path: expect.stringContaining('/results/') }))
  })

  it('reuses an immutable result after a worker crash between storage and completion', async () => {
    const upload = vi.fn(async () => ({ error: { message: 'already exists' } }))
    const remove = vi.fn(async () => ({ error: null }))
    const rpc = vi.fn(async () => ({ data: [{ manifest_id: 'manifest-existing' }], error: null }))
    const download = vi.fn(async () => ({ data: JSON.stringify({
      kind: 'agent-step-result', materialId: 'agent-result:run-1_writing_section-1:1',
      projectId: 'project-1', runId: 'run-1', stepId: 'run-1:writing:section-1',
      expiresAt: '2026-08-17T10:00:00.000Z',
    }) }))

    const stored = await storeAgentStepResult({ rpc, storage: { from: vi.fn(() => ({ upload, remove, download })) } }, {
      userId: 'user-1', projectId: 'project-1', runId: 'run-1', step, result, verification,
      now: () => Date.parse('2026-08-16T10:00:00.000Z'),
    })

    expect(stored).toEqual({ ok: true, value: { manifestId: 'manifest-existing', materialId: 'agent-result:run-1_writing_section-1:1', expiresAt: '2026-08-17T10:00:00.000Z' } })
    expect(remove).not.toHaveBeenCalled()
  })

  it('rejects a result that targets a different section than the claimed step', async () => {
    const rpc = vi.fn(async () => ({ data: [{ manifest_id: 'manifest-result-1' }], error: null }))
    const stored = await storeAgentStepResult({ rpc, storage: { from: vi.fn(() => ({
      upload: vi.fn(async () => ({ error: null })),
      remove: vi.fn(async () => ({ error: null })),
    })) } }, {
      userId: 'user-1',
      projectId: 'project-1',
      runId: 'run-1',
      step,
      result: { ...result, sectionId: 'section-2' },
      verification,
    })

    expect(stored).toEqual({ ok: false, error: 'Rezultat agenta ne pripada claimanoj sekciji.' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('loads only result payloads belonging to the requested run and project', async () => {
    const manifests = { list: vi.fn(async () => [
      { materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'user-1/project-1/run-1/result.json', manifestPath: 'user-1/project-1/run-1/manifest.json' },
      { materialId: 'source-1', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'source.json', manifestPath: 'source.manifest.json' },
    ]) }
    const payload = { ...result, agent: 'writing', stepId: 'step-1', materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', schemaVersion: 1, kind: 'agent-step-result', verifier: 'writing_verifier', attempt: 1, createdAt: '2026-08-14T10:00:00.000Z', expiresAt: '2026-08-17T10:00:00.000Z', verification }
    const storage = { download: vi.fn(async (path: string) => path.endsWith('/manifest.json') ? JSON.stringify({ ...payload, storagePath: 'result.json', materialId: 'agent-result:step-1:1' }) : JSON.stringify(payload)) }
    const loaded = await loadAgentRunResults(manifests, storage, { runId: 'run-1', projectId: 'project-1', userId: 'user-1', bucket: 'bucket', now: Date.parse('2026-08-15T00:00:00.000Z') })
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toMatchObject({ stepId: 'step-1', output: 'Novi odlomak rada.', projectId: 'project-1', claims: [{ id: 'claim-1', citationIds: ['source-1'] }] })
    expect(storage.download).toHaveBeenCalledWith('user-1/project-1/run-1/manifest.json')
    expect(storage.download).toHaveBeenCalledWith('user-1/project-1/run-1/result.json')
  })

  it('does not load scoped results when the caller omits the storage bucket', async () => {
    const manifests = { list: vi.fn(async () => [{
      materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1',
      storageBucket: 'bucket', storagePath: 'result.json', manifestPath: 'manifest.json',
    }]) }
    const storage = { download: vi.fn() }

    await expect(loadAgentRunResults(manifests, storage, {
      runId: 'run-1', projectId: 'project-1', userId: 'user-1',
    })).resolves.toEqual([])
    expect(storage.download).not.toHaveBeenCalled()
  })

  it('does not load results when the caller omits the owner scope', async () => {
    const manifests = { list: vi.fn(async () => [{
      materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1',
      storageBucket: 'bucket', storagePath: 'user-1/project-1/run-1/result.json', manifestPath: 'user-1/project-1/run-1/manifest.json',
    }]) }
    const storage = { download: vi.fn() }

    await expect(loadAgentRunResults(manifests, storage, {
      runId: 'run-1', projectId: 'project-1', bucket: 'bucket',
    })).resolves.toEqual([])
    expect(storage.download).not.toHaveBeenCalled()
  })

  it('does not expose an expired temporary result payload', async () => {
    const manifests = { list: vi.fn(async () => [
      { materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'user-1/project-1/run-1/result.json', manifestPath: 'user-1/project-1/run-1/manifest.json' },
    ]) }
    const payload = { ...result, agent: 'writing', stepId: 'step-1', materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', schemaVersion: 1, kind: 'agent-step-result', verifier: 'writing_verifier', attempt: 1, createdAt: '2026-08-14T10:00:00.000Z', expiresAt: '2026-08-14T23:59:59.000Z', verification }
    const storage = { download: vi.fn(async (path: string) => path.endsWith('/manifest.json') ? JSON.stringify({ ...payload, storagePath: 'result.json', materialId: 'agent-result:step-1:1' }) : JSON.stringify(payload)) }

    await expect(loadAgentRunResults(manifests, storage, {
      runId: 'run-1', projectId: 'project-1', now: Date.parse('2026-08-15T00:00:00.000Z'),
    })).resolves.toEqual([])
  })

  it('fails closed when a result manifest exceeds the bounded download size', async () => {
    const manifests = { list: vi.fn(async () => [
      { materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'user-1/project-1/run-1/result.json', manifestPath: 'user-1/project-1/run-1/manifest.json' },
    ]) }
    const storage = { download: vi.fn(async () => 'x'.repeat(3 * 1024 * 1024)) }

    await expect(loadAgentRunResults(manifests, storage, { runId: 'run-1', projectId: 'project-1', userId: 'user-1', bucket: 'bucket' }))
      .rejects.toThrow('Rezultat agenta je prevelik')
  })

  it('rejects result payloads with malformed citations or usage', async () => {
    const manifests = { list: vi.fn(async () => [
      { materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'user-1/project-1/run-1/result.json', manifestPath: 'user-1/project-1/run-1/manifest.json' },
    ]) }
    const payload = { ...result, agent: 'writing', stepId: 'step-1', materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', schemaVersion: 1, kind: 'agent-step-result', verifier: 'writing_verifier', attempt: 1, createdAt: '2026-08-14T10:00:00.000Z', expiresAt: '2026-08-17T10:00:00.000Z', verification, citations: [{ id: '', verified: 'yes' }], usage: { inputTokens: -1, outputTokens: 4 } }
    const storage = { download: vi.fn(async (path: string) => path.endsWith('/manifest.json') ? JSON.stringify({ ...payload, storagePath: 'result.json' }) : JSON.stringify(payload)) }

    await expect(loadAgentRunResults(manifests, storage, { runId: 'run-1', projectId: 'project-1', userId: 'user-1', bucket: 'bucket' })).resolves.toEqual([])
  })

  it('rejects a result whose step identity does not match its manifest identity', async () => {
    const manifests = { list: vi.fn(async () => [{
      materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1',
      storageBucket: 'bucket', storagePath: 'user-1/project-1/run-1/result.json', manifestPath: 'user-1/project-1/run-1/manifest.json',
    }]) }
    const payload = {
      ...result,
      agent: 'writing',
      stepId: 'step-other',
      materialId: 'agent-result:step-1:1',
      projectId: 'project-1',
      runId: 'run-1',
      schemaVersion: 1,
      kind: 'agent-step-result',
      verifier: 'writing_verifier',
      attempt: 1,
      createdAt: '2026-08-14T10:00:00.000Z',
      expiresAt: '2026-08-17T10:00:00.000Z',
      verification,
    }
    const storage = {
      download: vi.fn(async (path: string) => path.endsWith('/manifest.json')
        ? JSON.stringify({ ...payload, storagePath: 'result.json' })
        : JSON.stringify(payload)),
    }

    await expect(loadAgentRunResults(manifests, storage, { runId: 'run-1', projectId: 'project-1', userId: 'user-1', bucket: 'bucket' }))
      .resolves.toEqual([])
  })

  it('accepts canonical step ids after storage-safe path normalization', async () => {
    const manifests = { list: vi.fn(async () => [{
      materialId: 'agent-result:run-1_writing_section-1:1', projectId: 'project-1', runId: 'run-1',
      storageBucket: 'bucket', storagePath: 'user-1/project-1/run-1/result.json', manifestPath: 'user-1/project-1/run-1/manifest.json',
    }]) }
    const payload = {
      ...result,
      agent: 'writing',
      stepId: 'run-1:writing:section-1',
      materialId: 'agent-result:run-1_writing_section-1:1',
      projectId: 'project-1',
      runId: 'run-1',
      schemaVersion: 1,
      kind: 'agent-step-result',
      verifier: 'writing_verifier',
      attempt: 1,
      createdAt: '2026-08-14T10:00:00.000Z',
      expiresAt: '2026-08-17T10:00:00.000Z',
      verification,
    }
    const storage = {
      download: vi.fn(async (path: string) => path.endsWith('/manifest.json')
        ? JSON.stringify({ ...payload, storagePath: 'result.json' })
        : JSON.stringify(payload)),
    }

    await expect(loadAgentRunResults(manifests, storage, { runId: 'run-1', projectId: 'project-1', userId: 'user-1', bucket: 'bucket', now: Date.parse('2026-08-15T00:00:00.000Z') }))
      .resolves.toHaveLength(1)
  })

  it('rejects a step attempt outside the bounded retry range before upload', async () => {
    const upload = vi.fn(async () => ({ error: null }))
    const rpc = vi.fn(async () => ({ data: [{ manifest_id: 'manifest-result-1' }], error: null }))
    const stored = await storeAgentStepResult({ rpc, storage: { from: vi.fn(() => ({
      upload,
      remove: vi.fn(async () => ({ error: null })),
    })) } }, {
      userId: 'user-1',
      projectId: 'project-1',
      runId: 'run-1',
      step: { ...step, attempt: 4 as unknown as 1 | 2 | 3 },
      result,
      verification,
    })

    expect(stored).toEqual({ ok: false, error: 'Pokusaj agenta nije valjan.' })
    expect(upload).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

})
