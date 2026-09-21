export interface ExpiredAgentPayload {
  manifestId: string
  bucket: string
  storagePath: string
  manifestPath: string
}

export interface AgentPayloadCleanupStore {
  listExpired: (now: string) => Promise<ExpiredAgentPayload[]>
  remove: (payload: ExpiredAgentPayload) => Promise<{ ok: true } | { ok: false; error: string }>
  finalize: (now: string) => Promise<{ ok: true; deleted: number } | { ok: false; error: string }>
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
      const result = await db.from('agent_payload_manifests')
        .select('manifest_id, storage_bucket, storage_path, manifest_path')
        .is('deleted_at', null)
        .lte('expires_at', now)
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
    async finalize(now) {
      const result = await db.rpc('cleanup_expired_agent_payloads', { p_now: now })
      if (result.error) return { ok: false, error: result.error.message || 'Payload cleanup RPC failed.' }
      return { ok: true, deleted: Array.isArray(result.data) ? result.data.length : 0 }
    },
  }
}

/**
 * Storage-first cleanup. The canonical RPC marks manifests deleted only after
 * all private objects have been removed, so a transient storage outage remains
 * retryable instead of leaving an invisible object behind.
 */
export async function cleanupExpiredAgentPayloads(store: AgentPayloadCleanupStore, now = new Date().toISOString()): Promise<AgentPayloadCleanupResult> {
  let expired: ExpiredAgentPayload[]
  try {
    expired = await store.listExpired(now)
  } catch (error) {
    return { ok: false, deleted: 0, error: error instanceof Error ? error.message : 'Expired payload query failed.' }
  }
  if (!expired.length) return { ok: true, deleted: 0 }

  for (const payload of expired) {
    let removed: { ok: true } | { ok: false; error: string }
    try {
      removed = await store.remove(payload)
    } catch (error) {
      return { ok: false, deleted: 0, error: error instanceof Error ? error.message : 'Payload object removal failed.' }
    }
    if (removed.ok === false) return { ok: false, deleted: 0, error: removed.error }
  }

  let finalized: { ok: true; deleted: number } | { ok: false; error: string }
  try {
    finalized = await store.finalize(now)
  } catch (error) {
    return { ok: false, deleted: 0, error: error instanceof Error ? error.message : 'Payload cleanup RPC failed.' }
  }
  if (finalized.ok === false) return { ok: false, deleted: 0, error: finalized.error }
  return finalized
}
