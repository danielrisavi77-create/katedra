import { describe, expect, it, vi } from 'vitest'

import type { AgentStepRecord } from './run-state'
import type { AgentResultV1, VerificationResultV1 } from './contracts'
import { loadAgentRunResults, storeAgentStepResult } from './run-result-storage'

const step: AgentStepRecord = {
  id: 'run-1:writing:section-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'section-1', order: 4, attempt: 1, status: 'running',
}
const result: Omit<AgentResultV1, 'agent'> = {
  output: 'Novi odlomak rada.', citations: [{ id: 'source-1', url: 'https://example.test/source', verified: true }], claims: [{ id: 'claim-1', text: 'Novi odlomak rada.', citationIds: ['source-1'] }], provider: 'test-provider', usage: { inputTokens: 10, outputTokens: 20 }, baseRevision: '2026-08-14T10:00:00.000Z', sectionId: 'section-1',
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

  it('loads only result payloads belonging to the requested run and project', async () => {
    const manifests = { list: vi.fn(async () => [
      { materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'result.json', manifestPath: 'manifest.json' },
      { materialId: 'source-1', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'source.json', manifestPath: 'source.manifest.json' },
    ]) }
    const payload = { ...result, agent: 'writing', stepId: 'step-1', materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', schemaVersion: 1, kind: 'agent-step-result', verifier: 'writing_verifier', attempt: 1, createdAt: '2026-08-14T10:00:00.000Z', expiresAt: '2026-08-17T10:00:00.000Z', verification }
    const storage = { download: vi.fn(async (path: string) => path === 'manifest.json' ? JSON.stringify({ ...payload, storagePath: 'result.json', materialId: 'agent-result:step-1:1' }) : JSON.stringify(payload)) }
    const loaded = await loadAgentRunResults(manifests, storage, { runId: 'run-1', projectId: 'project-1' })
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toMatchObject({ stepId: 'step-1', output: 'Novi odlomak rada.', projectId: 'project-1', claims: [{ id: 'claim-1', citationIds: ['source-1'] }] })
    expect(storage.download).toHaveBeenCalledWith('manifest.json')
    expect(storage.download).toHaveBeenCalledWith('result.json')
  })

  it('does not expose an expired temporary result payload', async () => {
    const manifests = { list: vi.fn(async () => [
      { materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'result.json', manifestPath: 'manifest.json' },
    ]) }
    const payload = { ...result, agent: 'writing', stepId: 'step-1', materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', schemaVersion: 1, kind: 'agent-step-result', verifier: 'writing_verifier', attempt: 1, createdAt: '2026-08-14T10:00:00.000Z', expiresAt: '2026-08-14T23:59:59.000Z', verification }
    const storage = { download: vi.fn(async (path: string) => path === 'manifest.json' ? JSON.stringify({ ...payload, storagePath: 'result.json', materialId: 'agent-result:step-1:1' }) : JSON.stringify(payload)) }

    await expect(loadAgentRunResults(manifests, storage, {
      runId: 'run-1', projectId: 'project-1', now: Date.parse('2026-08-15T00:00:00.000Z'),
    })).resolves.toEqual([])
  })
})
