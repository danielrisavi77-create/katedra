import { logOperationalEvent } from '../observability/operational-events'

export interface ExpiredAgentPayload {
  manifestId: string
  bucket: string
  storagePath: string
  manifestPath: string
}

export interface AgentPayloadCleanupStore {
  listExpired: (now: string) => Promise<ExpiredAgentPayload[]>
  remove: (payload: ExpiredAgentPayload) => Promise<{ ok: true } | { ok: false; error: string }>
  finalize: (now: string, manifestIds?: string[]) => Promise<{ ok: true; deleted: number } | { ok: false; error: string }>
}

export type AgentPayloadCleanupResult =
  | { ok: true; deleted: number }
  | { ok: false; deleted: number; error: string }

interface PayloadQueryResult {
  data?: unknown
  error?: { message?: string } | null
}

interface PayloadQuery extends PromiseLike<PayloadQueryResult> {
  select: (columns: string) => PayloadQuery
  is: (column: string, value: unknown) => PayloadQuery
  lte: (column: string, value: unknown) => PayloadQuery
}

interface SupabasePayloadCleanupClient {
  from: (table: string) => PayloadQuery
  rpc: (functionName: string, params: Record<string, unknown>) => Promise<PayloadQueryResult>
  storage: { from: (bucket: string) => { remove: (paths: string[]) => Promise<{ error?: { message?: string } | null }> } }
}

export function createSupabaseAgentPayloadCleanupStore(db: SupabasePayloadCleanupClient, defaultBucket = 'katedra-temporary-materials'): AgentPayloadCleanupStore {
  return {
    async listExpired(now) {
      const result = await db.rpc('list_pending_agent_payload_deletions', { p_now: now })
      if (result.error) throw new Error(result.error.message || 'Expired payload query failed.')
      return (Array.isArray(result.data) ? result.data : []).flatMap((row) => {
        if (!row || typeof row !== 'object') return []
        const value = row as Record<string, unknown>
        const manifestId = String(value.manifest_id || '')
        const bucket = String(value.storage_bucket || defaultBucket)
        const storagePath = String(value.storage_path || '')
        const manifestPath = String(value.manifest_path || '')
        return manifestId && storagePath && manifestPath ? [{ manifestId, bucket, storagePath, manifestPath }] : []
      })
    },
    async remove(payload) {
      const result = await db.storage.from(payload.bucket || defaultBucket).remove([payload.storagePath, payload.manifestPath])
      return result.error ? { ok: false, error: result.error.message || 'Payload object removal failed.' } : { ok: true }
    },
    async finalize(now, manifestIds = []) {
      const result = await db.rpc('finalize_agent_payload_deletions', { p_manifest_ids: manifestIds, p_now: now })
      if (result.error) return { ok: false, error: result.error.message || 'Payload cleanup RPC failed.' }
      const row = Array.isArray(result.data) ? result.data[0] : result.data
      const deleted = row && typeof row === 'object' ? Number((row as Record<string, unknown>).deleted ?? 0) : 0
      return { ok: true, deleted: Number.isFinite(deleted) ? deleted : 0 }
    },
  }
}

function cleanupFailure(reason: 'query' | 'storage' | 'finalize'): AgentPayloadCleanupResult {
  logOperationalEvent({ eventName: 'agent_payload_ttl_cleanup_failed', reason }, 'error')
  return { ok: false, deleted: 0, error: `Agent payload cleanup failed during ${reason}.` }
}

/**
 * Storage-first cleanup. The canonical RPC tombstones pending manifests before
 * Storage removal so a worker crash cannot make an object undiscoverable. The
 * final RPC writes `content_deleted_at` only after both objects are removed;
 * until then the scheduler can safely claim and retry the same manifest.
 */
export async function cleanupExpiredAgentPayloads(store: AgentPayloadCleanupStore, now = new Date().toISOString()): Promise<AgentPayloadCleanupResult> {
  let expired: ExpiredAgentPayload[]
  try {
    expired = await store.listExpired(now)
  } catch {
    return cleanupFailure('query')
  }
  if (!expired.length) return { ok: true, deleted: 0 }

  for (const payload of expired) {
    let removed: { ok: true } | { ok: false; error: string }
    try {
      removed = await store.remove(payload)
    } catch {
      return cleanupFailure('storage')
    }
    if (removed.ok === false) return cleanupFailure('storage')
  }

  let finalized: { ok: true; deleted: number } | { ok: false; error: string }
  try {
    finalized = await store.finalize(now, expired.map((payload) => payload.manifestId))
  } catch {
    return cleanupFailure('finalize')
  }
  if (finalized.ok === false) return cleanupFailure('finalize')
  if (finalized.deleted > 0) {
    logOperationalEvent({ eventName: 'agent_payload_ttl_cleanup_completed', outcome: 'deleted' })
  }
  return finalized
}
