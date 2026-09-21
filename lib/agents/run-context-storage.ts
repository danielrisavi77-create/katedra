import { randomUUID } from 'node:crypto'
import { loadRunContextManifest } from './run-context-loader'
import { registerAgentPayload } from './backend-contract'
import { MAX_AGENT_CONTEXT_BYTES, runContextStoragePaths, validateAgentRunContext } from './run-context'
import type { PlanApprovalV1 } from './plan-approval'

const DEFAULT_BUCKET = 'katedra-temporary-materials'
const CONTEXT_TTL_MS = 72 * 60 * 60 * 1000

interface StorageObjectClient {
  download?: (path: string) => Promise<{ data?: { arrayBuffer: () => Promise<ArrayBuffer | Uint8Array> } | null; error?: unknown }>
  upload: (path: string, body: Uint8Array, options: { contentType: string; cacheControl: string; upsert: boolean }) => Promise<{ error?: { message?: string } | null }>
  remove: (paths: string[]) => Promise<{ error?: { message?: string } | null }>
}

interface RunContextDatabase {
  rpc: (functionName: string, params: Record<string, unknown>) => Promise<{ data?: unknown; error?: { message?: string } | null }>
  storage: { from: (bucket: string) => StorageObjectClient }
}

export type StoreRunContextResult =
  | { ok: true; value: { manifestId: string; expiresAt: string; storagePath: string; manifestPath: string } }
  | { ok: false; status: 400 | 403 | 413 | 503; error: string }

export async function storeAgentRunContext(
  db: RunContextDatabase,
  input: {
    userId: string
    projectId: string
    runId: string
    manuscript: unknown
    bucket?: string
    now?: () => number
  },
): Promise<StoreRunContextResult> {
  const validated = validateAgentRunContext({ manuscript: input.manuscript }, input.projectId)
  if (validated.ok === false) return {
    ok: false,
    status: validated.reason === 'project_mismatch' ? 403 : validated.reason === 'too_large' ? 413 : 400,
    error: validated.error,
  }

  const contextRevision = randomUUID()
  const body = new TextEncoder().encode(JSON.stringify({ manuscript: validated.manuscript, contextRevision }))
  if (body.byteLength > MAX_AGENT_CONTEXT_BYTES) return { ok: false, status: 413, error: 'Kontekst rukopisa je prevelik.' }

  const { storagePath, manifestPath } = runContextStoragePaths(input.userId, input.projectId, input.runId)
  const expiresAt = new Date((input.now || Date.now)() + CONTEXT_TTL_MS).toISOString()
  const bucket = input.bucket || DEFAULT_BUCKET
  const storage = db.storage.from(bucket)
  const upload = await storage.upload(storagePath, body, { contentType: 'application/json', cacheControl: '0', upsert: true })
  if (upload.error) return { ok: false, status: 503, error: 'Privremena pohrana konteksta nije uspjela.' }

  const manifest = {
    schemaVersion: 1,
    kind: 'run-context',
    contextRevision,
    materialId: 'run-context',
    runId: input.runId,
    projectId: input.projectId,
    storagePath,
    contentType: 'application/json',
    expiresAt,
  }
  const manifestUpload = await storage.upload(manifestPath, new TextEncoder().encode(JSON.stringify(manifest)), {
    contentType: 'application/json',
    cacheControl: '0',
    upsert: true,
  })
  if (manifestUpload.error) {
    await storage.remove([storagePath])
    return { ok: false, status: 503, error: 'Spremanje statusa konteksta nije uspjelo.' }
  }

  const registered = await registerAgentPayload(db, {
    userId: input.userId,
    projectId: input.projectId,
    runId: input.runId,
    materialId: 'run-context',
    storageBucket: bucket,
    storagePath,
    manifestPath,
    expiresAt,
  })
  if (!registered.ok) {
    await storage.remove([storagePath, manifestPath])
    return { ok: false, status: 503, error: 'Registracija konteksta nije uspjela.' }
  }

  return { ok: true, value: { manifestId: registered.value.manifestId, expiresAt, storagePath, manifestPath } }
}


// Approval writes only metadata: a delayed confirmation must never restore an older manuscript.
export async function storePlanApproval(db: RunContextDatabase, input: {
  userId: string; projectId: string; runId: string; contextRevision: string;
  planApproval: PlanApprovalV1; bucket?: string
}): Promise<{ ok: true } | { ok: false; status: 409 | 503; error: string }> {
  const paths = runContextStoragePaths(input.userId, input.projectId, input.runId)
  const storage = db.storage.from(input.bucket || DEFAULT_BUCKET)
  const manifest = await loadRunContextManifest({ download: async (path) => {
    const result = await storage.download?.(path)
    if (!result?.data || result.error) throw new Error('Context manifest unavailable')
    return result.data.arrayBuffer()
  } }, { ...paths, projectId: input.projectId, runId: input.runId, contextRevision: input.contextRevision })
  if (!manifest) return { ok: false, status: 409, error: 'Kontekst se promijenio. Ponovno pošalji kontekst pa pregledaj i odobri plan.' }
  const upload = await storage.upload(paths.manifestPath, new TextEncoder().encode(JSON.stringify({
    ...manifest, planApproval: input.planApproval,
  })), { contentType: 'application/json', cacheControl: '0', upsert: true })
  return upload.error ? { ok: false, status: 503, error: 'Potvrdu plana nije moguće spremiti.' } : { ok: true }
}
