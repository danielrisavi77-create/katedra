import { MAX_AGENT_CONTEXT_BYTES, runContextStoragePaths, validateAgentRunContext } from './run-context'
import type { PlanApprovalV1 } from './plan-approval'
import { trackedPayloadUpload, type TrackedUploadClient } from './tracked-upload'

const DEFAULT_BUCKET = 'katedra-temporary-materials'

interface StorageObjectClient {
  download?: (path: string) => Promise<{ data?: { arrayBuffer: () => Promise<ArrayBuffer | Uint8Array> } | null; error?: unknown }>
  upload: (path: string, body: Uint8Array, options: { contentType: string; cacheControl: string; upsert: boolean }) => Promise<{ error?: { message?: string } | null }>
  remove: (paths: string[]) => Promise<{ error?: { message?: string } | null }>
}

interface RunContextDatabase {
  rpc: (functionName: string, params: Record<string, unknown>) => Promise<{ data?: unknown; error?: { message?: string; code?: string } | null }>
  storage: { from: (bucket: string) => StorageObjectClient }
}

export type StoreRunContextResult =
  | { ok: true; value: { manifestId: string; expiresAt: string; storagePath: string; manifestPath: string } }
  | { ok: false; status: 400 | 403 | 409 | 413 | 503; error: string }

export async function storeAgentRunContext(
  db: RunContextDatabase,
  input: {
    userId: string
    projectId: string
    runId: string
    manuscript: unknown
    materialIds?: string[]
    bucket?: string
    now?: () => number
  },
  createUploadClient: () => TrackedUploadClient = () => db,
): Promise<StoreRunContextResult> {
  const validated = validateAgentRunContext({ manuscript: input.manuscript }, input.projectId)
  if (validated.ok === false) return {
    ok: false,
    status: validated.reason === 'project_mismatch' ? 403 : validated.reason === 'too_large' ? 413 : 400,
    error: validated.error,
  }

  try {
    const reserved = await db.rpc('reserve_agent_run_context', { p_user_id: input.userId, p_project_id: input.projectId, p_run_id: input.runId })
    const allocation = Array.isArray(reserved.data) && reserved.data.length === 1 ? reserved.data[0] : null
    if (reserved.error || !allocation || typeof allocation.manifest_id !== 'string' || !allocation.manifest_id
      || typeof allocation.context_revision !== 'string' || typeof allocation.expires_at !== 'string') {
      return { ok: false, status: 503, error: 'Rezervacija konteksta nije uspjela.' }
    }
    const contextRevision = allocation.context_revision
    const { storagePath, manifestPath } = runContextStoragePaths(input.userId, input.projectId, input.runId, contextRevision)
    const expiresAt = allocation.expires_at
    if (allocation.storage_path !== storagePath || allocation.manifest_path !== manifestPath
      || !(Date.parse(expiresAt) > (input.now || Date.now)())) {
      return { ok: false, status: 503, error: 'Rezervacija konteksta nije valjana za ovaj run.' }
    }
    const body = new TextEncoder().encode(JSON.stringify({ manuscript: validated.manuscript, contextRevision }))
    if (body.byteLength > MAX_AGENT_CONTEXT_BYTES) return { ok: false, status: 413, error: 'Kontekst rukopisa je prevelik.' }

    const bucket = input.bucket || DEFAULT_BUCKET
    if (bucket !== DEFAULT_BUCKET) return { ok: false, status: 503, error: 'Privremeni bucket ne odgovara kanonskom ugovoru.' }
    const uploadClient = createUploadClient()
    const uploaded = await trackedPayloadUpload(uploadClient, { manifestId: allocation.manifest_id, kind: 'body', path: storagePath, body })
    if (!uploaded) return { ok: false, status: 503, error: 'Privremena pohrana konteksta nije potvrđena.' }

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
    const manifestUploaded = await trackedPayloadUpload(uploadClient, {
      manifestId: allocation.manifest_id, kind: 'manifest', path: manifestPath, body: new TextEncoder().encode(JSON.stringify(manifest)),
    })
    if (!manifestUploaded) {
      return { ok: false, status: 503, error: 'Spremanje statusa konteksta nije uspjelo.' }
    }

    const committed = await db.rpc('commit_agent_run_context', {
      p_user_id: input.userId, p_project_id: input.projectId, p_run_id: input.runId,
      p_manifest_id: allocation.manifest_id, p_material_ids: input.materialIds ?? [],
    })
    if (committed.error || committed.data !== allocation.manifest_id) {
      // Odgovor se moze izgubiti nakon commita. Brisanje ovdje moglo bi izbrisati aktivnu verziju.
      // Kanonski TTL i cleanup obradjuju neobjavljene rezervacije.
      return { ok: false, status: committed.error?.code === '40901' ? 409 : 503, error: 'Objava konteksta nije potvrđena.' }
    }

    return { ok: true, value: { manifestId: allocation.manifest_id, expiresAt, storagePath, manifestPath } }
  } catch {
    return { ok: false, status: 503, error: 'Privremena pohrana konteksta nije dostupna.' }
  }
}


// Approval writes only metadata: a delayed confirmation must never restore an older manuscript.
export async function storePlanApproval(db: RunContextDatabase, input: {
  userId: string; projectId: string; runId: string; contextRevision: string;
  planApproval: PlanApprovalV1; bucket?: string
}): Promise<{ ok: true } | { ok: false; status: 409 | 503; error: string }> {
  try {
    const result = await db.rpc('approve_agent_run_context_plan', {
      p_user_id: input.userId, p_project_id: input.projectId, p_run_id: input.runId,
      p_context_revision: input.contextRevision, p_plan_revision: input.planApproval.planRevision, p_approve: true,
    })
    if (result.error) return { ok: false, status: result.error.code === '40901' ? 409 : 503, error: 'Potvrda nije spremljena. Ponovno pregledaj aktivni plan.' }
    const approval = result.data as Partial<PlanApprovalV1> | null
    if (!approval || approval.approvedBy !== input.userId || approval.runId !== input.runId
      || approval.projectId !== input.projectId || approval.planRevision !== input.planApproval.planRevision) {
      return { ok: false, status: 503, error: 'Kanonska potvrda plana nije dostupna.' }
    }
    return { ok: true }
  } catch {
    return { ok: false, status: 503, error: 'Potvrdu plana nije moguće spremiti.' }
  }
}
