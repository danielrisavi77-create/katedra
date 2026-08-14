import { validateAgentRunContext } from './run-context'
import type { ManuscriptV1 } from '../manuscript/types'

export interface RunPayloadStorage {
  download(path: string): Promise<Uint8Array | ArrayBuffer | string>
}

export interface RunPayloadManifest {
  materialId: string
  projectId: string
  runId: string
  storageBucket: string
  storagePath: string
  manifestPath: string
}

export interface RunPayloadManifestStore {
  list(runId: string, projectId: string): Promise<RunPayloadManifest[]>
}

interface ManifestQueryResult {
  data?: unknown
  error?: { message?: string } | null
}

interface ManifestQuery extends PromiseLike<ManifestQueryResult> {
  select: (columns: string) => ManifestQuery
  eq: (column: string, value: unknown) => ManifestQuery
  is: (column: string, value: unknown) => ManifestQuery
}

interface RunPayloadManifestDatabase {
  from: (table: string) => ManifestQuery
}

export interface RunMaterialContext {
  id: string
  name: string
  kind: string
  text?: string
  warnings: string[]
}

export function createSupabaseRunPayloadManifestStore(db: RunPayloadManifestDatabase): RunPayloadManifestStore {
  return {
    async list(runId, projectId) {
      const result = await db.from('agent_payload_manifests')
        .select('material_id, project_id, run_id, storage_bucket, storage_path, manifest_path')
        .eq('run_id', runId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
      if (result.error) throw new Error(result.error.message || 'Run payload manifest query failed.')
      return (Array.isArray(result.data) ? result.data : []).flatMap((row) => {
        if (!row || typeof row !== 'object') return []
        const value = row as Record<string, unknown>
        const materialId = String(value.material_id || '')
        const rowProjectId = String(value.project_id || '')
        const rowRunId = String(value.run_id || '')
        const storageBucket = String(value.storage_bucket || '')
        const storagePath = String(value.storage_path || '')
        const manifestPath = String(value.manifest_path || '')
        return materialId && rowProjectId === projectId && rowRunId === runId && storageBucket && storagePath && manifestPath
          ? [{ materialId, projectId: rowProjectId, runId: rowRunId, storageBucket, storagePath, manifestPath }]
          : []
      })
    },
  }
}

export async function loadRunManuscriptContext(
  storage: RunPayloadStorage,
  input: { storagePath: string; projectId: string },
): Promise<ManuscriptV1> {
  const raw = await storage.download(input.storagePath)
  const bytes = toBytes(raw)
  let body: unknown
  try {
    body = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error('Run payload kontekst nije valjan JSON.')
  }
  const result = validateAgentRunContext(body, input.projectId, bytes.byteLength)
  if (result.ok === false) throw new Error(result.error)
  return result.manuscript
}

export async function loadRunMaterialContexts(
  manifests: RunPayloadManifestStore,
  storage: RunPayloadStorage,
  input: { runId: string; projectId: string },
): Promise<RunMaterialContext[]> {
  const entries = await manifests.list(input.runId, input.projectId)
  const contexts = await Promise.all(entries.map(async (entry) => {
    if (entry.runId !== input.runId || entry.projectId !== input.projectId) return null
    try {
      const raw = await storage.download(entry.manifestPath)
      const value = JSON.parse(new TextDecoder().decode(toBytes(raw))) as Record<string, unknown>
      if (String(value.id || '') !== entry.materialId || String(value.projectId || '') !== input.projectId) return null
      const name = typeof value.name === 'string' ? value.name.slice(0, 300) : ''
      const kind = typeof value.kind === 'string' ? value.kind : ''
      if (!name || !kind) return null
      if (typeof value.extractedText === 'string' && value.extractedText.length > 250_000) return null
      const text = typeof value.extractedText === 'string' ? value.extractedText : undefined
      const warnings = Array.isArray(value.warnings) ? value.warnings.filter((warning): warning is string => typeof warning === 'string').slice(0, 20) : []
      const context: RunMaterialContext = { id: entry.materialId, name, kind, warnings }
      if (text !== undefined) context.text = text
      return context
    } catch {
      return null
    }
  }))
  return contexts.filter((context): context is RunMaterialContext => Boolean(context))
}

function toBytes(value: Uint8Array | ArrayBuffer | string): Uint8Array {
  if (typeof value === 'string') return new TextEncoder().encode(value)
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  return value
}
