import { describe, expect, it, vi } from 'vitest'

import { loadRunMaterialContexts } from './run-context-loader'

describe('run material context loader', () => {
  it('loads only manifests belonging to the requested run and project', async () => {
    const manifestStore = {
      list: vi.fn(async () => [{
        materialId: 'material-1',
        projectId: 'project-1',
        runId: 'run-1',
        storageBucket: 'bucket',
        storagePath: 'raw',
        manifestPath: 'manifest',
      }]),
    }
    const storage = {
      download: vi.fn(async () => new TextEncoder().encode(JSON.stringify({
        id: 'material-1', projectId: 'project-1', name: 'Upute', kind: 'mentor', mimeType: 'text/plain',
        extractionStatus: 'extracted', extractedText: 'Mentor traži jasnu tezu.', warnings: [], expiresAt: '2026-08-17T10:00:00.000Z',
      })).buffer),
    }

    await expect(loadRunMaterialContexts(manifestStore, storage, { runId: 'run-1', projectId: 'project-1' })).resolves.toEqual([{
      id: 'material-1', name: 'Upute', kind: 'mentor', text: 'Mentor traži jasnu tezu.', warnings: [],
    }])
    expect(manifestStore.list).toHaveBeenCalledWith('run-1', 'project-1')
    expect(storage.download).toHaveBeenCalledWith('manifest')
  })

  it('ignores malformed or oversized manifest content without failing the entire run', async () => {
    const manifestStore = { list: async () => [
      { materialId: 'bad', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'raw', manifestPath: 'bad' },
      { materialId: 'large', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'raw', manifestPath: 'large' },
    ] }
    const storage = { download: vi.fn(async (path: string) => path === 'bad' ? '{' : JSON.stringify({ id: 'large', projectId: 'project-1', name: 'Large', kind: 'notes', extractedText: 'x'.repeat(300_001), warnings: [] })) }

    await expect(loadRunMaterialContexts(manifestStore, storage, { runId: 'run-1', projectId: 'project-1' })).resolves.toEqual([])
  })
})
