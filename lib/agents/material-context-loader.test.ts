import { describe, expect, it, vi } from 'vitest'

import { loadRunManuscriptContext, loadRunMaterialContexts } from './run-context-loader'

describe('run material context loader', () => {
  it('rejects an oversized manuscript object before attempting JSON parsing', async () => {
    const storage = { download: vi.fn(async () => `${' '.repeat(5 * 1024 * 1024)}{`) }

    await expect(loadRunManuscriptContext(storage, { storagePath: 'manuscript', projectId: 'project-1' }))
      .rejects.toThrow('Kontekst rukopisa je prevelik')
  })

  it('loads only manifests belonging to the requested run and project', async () => {
    const manifestStore = {
      list: vi.fn(async () => [{
        materialId: 'material-1',
        projectId: 'project-1',
        runId: 'run-1',
        storageBucket: 'bucket',
        storagePath: 'user-1/project-1/run-1/raw',
        manifestPath: 'user-1/project-1/run-1/manifest',
      }]),
    }
    const storage = {
      download: vi.fn(async () => new TextEncoder().encode(JSON.stringify({
        id: 'material-1', projectId: 'project-1', name: 'Upute', kind: 'mentor', mimeType: 'text/plain',
        extractionStatus: 'extracted', extractedText: 'Mentor traži jasnu tezu.', warnings: [], expiresAt: '2026-08-17T10:00:00.000Z',
      })).buffer),
    }

    await expect(loadRunMaterialContexts(manifestStore, storage, { runId: 'run-1', projectId: 'project-1', userId: 'user-1', bucket: 'bucket', now: Date.parse('2026-08-15T00:00:00.000Z') })).resolves.toEqual([{
      id: 'material-1', name: 'Upute', kind: 'mentor', text: 'Mentor traži jasnu tezu.', warnings: [],
    }])
    expect(manifestStore.list).toHaveBeenCalledWith('run-1', 'project-1')
    expect(storage.download).toHaveBeenCalledWith('user-1/project-1/run-1/manifest')
  })

  it('loads bounded scan images separately for a vision-capable provider', async () => {
    const manifestStore = {
      list: vi.fn(async () => [{
        materialId: 'scan-1', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket',
        storagePath: 'user-1/project-1/run-1/scan.png', manifestPath: 'user-1/project-1/run-1/scan.manifest',
      }]),
    }
    const storage = {
      download: vi.fn(async (path: string) => path.endsWith('.manifest')
        ? JSON.stringify({ id: 'scan-1', projectId: 'project-1', name: 'Sken', kind: 'scan', mimeType: 'image/png', warnings: [], expiresAt: '2026-08-17T10:00:00.000Z' })
        : new Uint8Array([137, 80, 78, 71]).buffer),
    }

    await expect(loadRunMaterialContexts(manifestStore, storage, {
      runId: 'run-1', projectId: 'project-1', userId: 'user-1', bucket: 'bucket', now: Date.parse('2026-08-15T00:00:00.000Z'),
    })).resolves.toEqual([{ id: 'scan-1', name: 'Sken', kind: 'scan', warnings: [], image: { mimeType: 'image/png', data: 'iVBORw==' } }])
    expect(storage.download).toHaveBeenCalledWith('user-1/project-1/run-1/scan.png')
  })

  it('does not load scoped material when the caller omits the storage bucket', async () => {
    const manifestStore = {
      list: vi.fn(async () => [{
        materialId: 'material-1', projectId: 'project-1', runId: 'run-1',
        storageBucket: 'bucket', storagePath: 'raw', manifestPath: 'manifest',
      }]),
    }
    const storage = { download: vi.fn() }

    await expect(loadRunMaterialContexts(manifestStore, storage, {
      runId: 'run-1', projectId: 'project-1', userId: 'user-1',
    })).resolves.toEqual([])
    expect(storage.download).not.toHaveBeenCalled()
  })

  it('does not load materials when the caller omits the owner scope', async () => {
    const manifestStore = {
      list: vi.fn(async () => [{
        materialId: 'material-1', projectId: 'project-1', runId: 'run-1',
        storageBucket: 'bucket', storagePath: 'user-1/project-1/run-1/raw', manifestPath: 'user-1/project-1/run-1/manifest',
      }]),
    }
    const storage = { download: vi.fn() }

    await expect(loadRunMaterialContexts(manifestStore, storage, {
      runId: 'run-1', projectId: 'project-1', bucket: 'bucket',
    })).resolves.toEqual([])
    expect(storage.download).not.toHaveBeenCalled()
  })

  it('ignores malformed or oversized manifest content without failing the entire run', async () => {
    const manifestStore = { list: async () => [
      { materialId: 'bad', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'raw', manifestPath: 'bad' },
      { materialId: 'large', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'raw', manifestPath: 'large' },
    ] }
    const storage = { download: vi.fn(async (path: string) => path === 'bad' ? '{' : JSON.stringify({ id: 'large', projectId: 'project-1', name: 'Large', kind: 'notes', extractedText: 'x'.repeat(300_001), warnings: [] })) }

    await expect(loadRunMaterialContexts(manifestStore, storage, { runId: 'run-1', projectId: 'project-1' })).resolves.toEqual([])
  })

  it('ignores a manifest whose raw payload is over the bounded manifest limit', async () => {
    const manifestStore = { list: async () => [{ materialId: 'huge', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'raw', manifestPath: 'huge' }] }
    const storage = {
      download: vi.fn(async () => `${'{"id":"huge","projectId":"project-1","name":"Huge","kind":"notes","extractedText":"valid","warnings":[],"expiresAt":"2026-08-17T10:00:00.000Z","padding":"'}${'x'.repeat(1_100_000)}${'"}'}`),
    }

    await expect(loadRunMaterialContexts(manifestStore, storage, { runId: 'run-1', projectId: 'project-1' })).resolves.toEqual([])
  })

  it('does not load a material after its temporary TTL expires', async () => {
    const manifestStore = { list: async () => [{ materialId: 'expired', projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: 'raw', manifestPath: 'expired' }] }
    const storage = {
      download: vi.fn(async () => JSON.stringify({
        id: 'expired', projectId: 'project-1', name: 'Stare upute', kind: 'mentor',
        extractedText: 'Ne smije ući u run.', warnings: [], expiresAt: '2026-08-14T23:59:59.000Z',
      })),
    }

    await expect(loadRunMaterialContexts(manifestStore, storage, {
      runId: 'run-1', projectId: 'project-1', now: Date.parse('2026-08-15T00:00:00.000Z'),
    })).resolves.toEqual([])
  })

  it('fails closed when a run references too many materials', async () => {
    const manifestStore = {
      list: vi.fn(async () => Array.from({ length: 101 }, (_, index) => ({
        materialId: `material-${index}`, projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: `user-1/project-1/run-1/raw-${index}`, manifestPath: `user-1/project-1/run-1/manifest-${index}`,
      }))),
    }

    await expect(loadRunMaterialContexts(manifestStore, { download: vi.fn() }, { runId: 'run-1', projectId: 'project-1', userId: 'user-1', bucket: 'bucket' }))
      .rejects.toThrow('Previše materijala')
  })

  it('fails closed when combined extracted material context is too large', async () => {
    const manifestStore = {
      list: vi.fn(async () => Array.from({ length: 20 }, (_, index) => ({
        materialId: `material-${index}`, projectId: 'project-1', runId: 'run-1', storageBucket: 'bucket', storagePath: `user-1/project-1/run-1/raw-${index}`, manifestPath: `user-1/project-1/run-1/manifest-${index}`,
      }))),
    }
    const storage = {
      download: vi.fn(async (path: string) => JSON.stringify({
        id: path.replace(/^.*\/manifest-/u, 'material-'), projectId: 'project-1', name: path, kind: 'notes',
        extractedText: 'x'.repeat(250_000), warnings: [], expiresAt: '2026-08-17T10:00:00.000Z',
      })),
    }

    await expect(loadRunMaterialContexts(manifestStore, storage, { runId: 'run-1', projectId: 'project-1', userId: 'user-1', bucket: 'bucket', now: Date.parse('2026-08-15T00:00:00.000Z') }))
      .rejects.toThrow('Kontekst materijala je prevelik')
  })
})
