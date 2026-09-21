import { MAX_AGENT_CONTEXT_BYTES, validateAgentRunContext } from './run-context'
import { mapWithConcurrency } from '../async/map-limited'
import type { ManuscriptV1 } from '../manuscript/types'
import { isScopedAgentPayload } from './payload-scope'

const MAX_RUN_MATERIALS = 100
const MAX_MATERIAL_MANIFEST_BYTES = 1 * 1024 * 1024
const MAX_TOTAL_MATERIAL_CONTEXT_BYTES = 4 * 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_TOTAL_IMAGE_BYTES = 12 * 1024 * 1024
class MaterialContextLimitError extends Error {}

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
  expiresAt?: string
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
  image?: { mimeType: string; data: string }
  warnings: string[]
}

export function createSupabaseRunPayloadManifestStore(db: RunPayloadManifestDatabase): RunPayloadManifestStore {
  return {
    async list(runId, projectId) {
      const result = await db.from('agent_payload_manifests')
        .select('material_id, project_id, run_id, storage_bucket, storage_path, manifest_path, expires_at')
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
        const expiresAt = typeof value.expires_at === 'string' ? value.expires_at : undefined
        return materialId && rowProjectId === projectId && rowRunId === runId && storageBucket && storagePath && manifestPath
          ? [{ materialId, projectId: rowProjectId, runId: rowRunId, storageBucket, storagePath, manifestPath, expiresAt }]
          : []
      })
    },
  }
}

export async function loadRunContextSnapshot(
  storage: RunPayloadStorage,
  input: { storagePath: string; projectId: string; manifestPath?: string; runId?: string },
): Promise<{ manuscript: ManuscriptV1; contextRevision?: string; planApproval?: unknown }> {
  const raw = await storage.download(input.storagePath)
  const bytes = toBytes(raw)
  if (bytes.byteLength > MAX_AGENT_CONTEXT_BYTES) throw new Error('Kontekst rukopisa je prevelik.')
  let body: unknown
  try {
    body = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error('Run payload kontekst nije valjan JSON.')
  }
  const result = validateAgentRunContext(body, input.projectId, bytes.byteLength)
  if (result.ok === false) throw new Error(result.error)
  const contextRevision = body && typeof body === 'object' && 'contextRevision' in body && typeof body.contextRevision === 'string'
    ? body.contextRevision : undefined
  const manifest = input.manifestPath && input.runId && contextRevision
    ? await loadRunContextManifest(storage, { ...input, manifestPath: input.manifestPath, runId: input.runId, contextRevision }) : null
  return { manuscript: result.manuscript, contextRevision, planApproval: manifest?.planApproval }
}

export async function loadRunContextManifest(storage: RunPayloadStorage, input: {
  storagePath: string; manifestPath: string; projectId: string; runId: string; contextRevision: string
}): Promise<Record<string, unknown> | null> {
  try {
    const bytes = toBytes(await storage.download(input.manifestPath))
    if (bytes.byteLength > 16_384) return null
    const value = JSON.parse(new TextDecoder().decode(bytes))
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    if (!input.contextRevision || value.contextRevision !== input.contextRevision || value.schemaVersion !== 1
      || value.kind !== 'run-context' || value.materialId !== 'run-context' || value.projectId !== input.projectId
      || value.runId !== input.runId || value.storagePath !== input.storagePath
      || !isActiveTemporaryPayload(value.expiresAt, Date.now())) return null
    return value
  } catch { return null }
}

export async function loadRunManuscriptContext(
  storage: RunPayloadStorage,
  input: { storagePath: string; projectId: string },
): Promise<ManuscriptV1> {
  return (await loadRunContextSnapshot(storage, input)).manuscript
}

export async function loadRunMaterialContexts(
  manifests: RunPayloadManifestStore,
  storage: RunPayloadStorage,
  input: { runId: string; projectId: string; userId?: string; bucket?: string; now?: number },
): Promise<RunMaterialContext[]> {
  const { userId, bucket } = input
  if (!userId || !bucket) return []
  const entries = await manifests.list(input.runId, input.projectId)
  if (entries.length > MAX_RUN_MATERIALS) throw new MaterialContextLimitError('Previše materijala za jedan agenticni run.')
  const now = input.now ?? Date.now()
  const budget = { totalBytes: 0 }
  const imageBudget = { totalBytes: 0 }
  const contexts = await mapWithConcurrency(entries, 8, async (entry) => {
    if (entry.runId !== input.runId || entry.projectId !== input.projectId) return null
    if (!isScopedAgentPayload(entry, { userId, projectId: input.projectId, runId: input.runId, bucket })) return null
    try {
      const raw = await storage.download(entry.manifestPath)
      const bytes = toBytes(raw)
      if (bytes.byteLength > MAX_MATERIAL_MANIFEST_BYTES) return null
      const value = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
      if (String(value.id || '') !== entry.materialId || String(value.projectId || '') !== input.projectId) return null
      const name = typeof value.name === 'string' ? value.name.slice(0, 300) : ''
      const kind = typeof value.kind === 'string' ? value.kind : ''
      if (!name || !kind) return null
      if (!isActiveTemporaryPayload(value.expiresAt, now)) return null
      if (typeof value.extractedText === 'string' && value.extractedText.length > 250_000) return null
      const text = typeof value.extractedText === 'string' ? value.extractedText : undefined
      if (text !== undefined) {
        budget.totalBytes += new TextEncoder().encode(text).byteLength
        if (budget.totalBytes > MAX_TOTAL_MATERIAL_CONTEXT_BYTES) {
          throw new MaterialContextLimitError('Kontekst materijala je prevelik za jedan agenticni run.')
        }
      }
      const warnings = Array.isArray(value.warnings) ? value.warnings.filter((warning): warning is string => typeof warning === 'string').slice(0, 20) : []
      const context: RunMaterialContext = { id: entry.materialId, name, kind, warnings }
      if (text !== undefined) context.text = text
      const mimeType = typeof value.mimeType === 'string' ? value.mimeType.toLowerCase() : ''
      if (kind === 'scan' && isSupportedImageMime(mimeType)) {
        const raw = toBytes(await storage.download(entry.storagePath))
        if (raw.byteLength > MAX_IMAGE_BYTES || imageBudget.totalBytes + raw.byteLength > MAX_TOTAL_IMAGE_BYTES) {
          context.warnings = [...context.warnings, 'Sken je prevelik za sigurnu analizu slike.'].slice(0, 20)
        } else {
          imageBudget.totalBytes += raw.byteLength
          context.image = { mimeType, data: Buffer.from(raw).toString('base64') }
        }
      }
      return context
    } catch (error) {
      if (error instanceof MaterialContextLimitError) throw error
      return null
    }
  })
  return contexts.filter((context): context is RunMaterialContext => Boolean(context))
}

function isActiveTemporaryPayload(value: unknown, now: number): boolean {
  if (typeof value !== 'string') return false
  const expiresAt = Date.parse(value)
  return Number.isFinite(expiresAt) && expiresAt > now
}

function toBytes(value: Uint8Array | ArrayBuffer | string): Uint8Array {
  if (typeof value === 'string') return new TextEncoder().encode(value)
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  return value
}

function isSupportedImageMime(value: string): boolean {
  return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(value)
}
