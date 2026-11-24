import { logOperationalEvent } from '../observability/operational-events'

export type RunPayloadDeletionResult =
  | { ok: true; deleted: number; status: 'deleted' }
  | { ok: true; deleted: 0; status: 'deleted' }
  | { ok: false; status: 'deletion_scheduled' | 'contract_error'; error: string; deleted: number }

export type AccountPayloadDeletionResult =
  | { ok: true; deleted: number; status: 'deleted' }
  | { ok: false; status: 'deletion_scheduled' | 'contract_error'; error: string; deleted: number }

interface RpcResult {
  data?: unknown
  error?: { message?: string; code?: string } | null
}

interface RunPayloadDeletionClient {
  rpc: (name: string, params: Record<string, unknown>) => Promise<RpcResult>
  storage: { from: (bucket: string) => { remove: (paths: string[]) => Promise<{ error?: { message?: string } | null }> } }
}

interface RunPayloadDeletionInput {
  userId: string
  projectId: string
  runId: string
  now?: string
}

interface AccountPayloadDeletionInput {
  userId: string
  now?: string
}

type PayloadPath = {
  manifestId: string
  bucket: string
  storagePath: string
  manifestPath: string
}

export async function deleteAgentRunPayloads(
  db: RunPayloadDeletionClient,
  input: RunPayloadDeletionInput,
): Promise<RunPayloadDeletionResult> {
  const requested = await callRpc(db, 'request_agent_run_payload_deletion', {
    p_user_id: input.userId,
    p_project_id: input.projectId,
    p_run_id: input.runId,
    p_now: input.now || new Date().toISOString(),
  })
  if (requested.error) return failure('contract_error', requested.error.message || 'Canonical brisanje privremenih podataka nije dostupno.', 0)

  const paths = parsePayloadPaths(requested.data, input)
  if (paths.ok === false) return failure('contract_error', paths.error, 0)
  if (!paths.value.length) return { ok: true, deleted: 0, status: 'deleted' }

  const byBucket = new Map<string, string[]>()
  for (const payload of paths.value) {
    const bucketPaths = byBucket.get(payload.bucket) || []
    bucketPaths.push(payload.storagePath, payload.manifestPath)
    byBucket.set(payload.bucket, bucketPaths)
  }

  for (const [bucket, storagePaths] of byBucket) {
    try {
      const removed = await db.storage.from(bucket).remove(storagePaths)
      if (removed.error) return await scheduleFailure(db, input, removed.error.message || 'Privatni objekt nije moguće ukloniti.')
    } catch (error) {
      return await scheduleFailure(db, input, error instanceof Error ? error.message : 'Privatni objekt nije moguće ukloniti.')
    }
  }

  const finalized = await callRpc(db, 'finalize_agent_run_payload_deletion', {
    p_user_id: input.userId,
    p_project_id: input.projectId,
    p_run_id: input.runId,
    p_manifest_ids: paths.value.map((payload) => payload.manifestId),
  })
  if (finalized.error) return failure('deletion_scheduled', 'Privremeni podaci su označeni za brisanje, ali potvrda završetka nije dostupna.', 0)
  return { ok: true, deleted: paths.value.length, status: 'deleted' }
}

/**
 * Deletes every temporary agent payload owned by an account. The identity
 * deletion service must call this before removing the auth identity; a
 * storage failure therefore fails closed and leaves the account recoverable.
 */
export async function deleteUserAgentPayloads(
  db: RunPayloadDeletionClient,
  input: AccountPayloadDeletionInput,
): Promise<AccountPayloadDeletionResult> {
  const requested = await callRpc(db, 'request_user_agent_payload_deletion', {
    p_user_id: input.userId,
    p_now: input.now || new Date().toISOString(),
  })
  if (requested.error) return accountFailure('contract_error', requested.error.message || 'Canonical account cleanup nije dostupan.', 0)

  const paths = parseAccountPayloadPaths(requested.data, input.userId)
  if (paths.ok === false) return accountFailure('contract_error', paths.error, 0)
  if (!paths.value.length) return { ok: true, deleted: 0, status: 'deleted' }

  const byBucket = new Map<string, string[]>()
  for (const payload of paths.value) {
    const bucketPaths = byBucket.get(payload.bucket) || []
    bucketPaths.push(payload.storagePath, payload.manifestPath)
    byBucket.set(payload.bucket, bucketPaths)
  }

  for (const [bucket, storagePaths] of byBucket) {
    try {
      const removed = await db.storage.from(bucket).remove(storagePaths)
      if (removed.error) return await scheduleAccountFailure(db, input, removed.error.message || 'Privatni account payload nije moguće ukloniti.')
    } catch (error) {
      return await scheduleAccountFailure(db, input, error instanceof Error ? error.message : 'Privatni account payload nije moguće ukloniti.')
    }
  }

  const finalized = await callRpc(db, 'finalize_user_agent_payload_deletion', {
    p_user_id: input.userId,
    p_manifest_ids: paths.value.map((payload) => payload.manifestId),
  })
  if (finalized.error) return accountFailure('deletion_scheduled', 'Privremeni podaci su označeni za brisanje, ali potvrda završetka nije dostupna.', 0)
  return { ok: true, deleted: paths.value.length, status: 'deleted' }
}

async function scheduleFailure(db: RunPayloadDeletionClient, input: RunPayloadDeletionInput, error: string): Promise<RunPayloadDeletionResult> {
  const recorded = await callRpc(db, 'record_agent_run_payload_deletion_failure', {
    p_user_id: input.userId,
    p_project_id: input.projectId,
    p_run_id: input.runId,
    p_error_code: 'storage_delete_failed',
  })
  logOperationalEvent({
    eventName: 'agent_run_payload_cleanup_failed',
    userId: input.userId,
    projectId: input.projectId,
    runId: input.runId,
    reason: recorded.error ? 'failure_recording_failed' : 'storage_delete_failed',
    error,
  }, 'error')
  return failure('deletion_scheduled', 'Brisanje je zakazano za ponovni pokušaj jer privatna pohrana trenutačno nije dostupna.', 0)
}

async function callRpc(db: RunPayloadDeletionClient, name: string, params: Record<string, unknown>): Promise<RpcResult> {
  try {
    return await db.rpc(name, params)
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : `${name} nije dostupan.` } }
  }
}

function parsePayloadPaths(value: unknown, input: RunPayloadDeletionInput): { ok: true; value: PayloadPath[] } | { ok: false; error: string } {
  const rows = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []
  const prefix = `${input.userId}/${input.projectId}/`
  const result: PayloadPath[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') return { ok: false, error: 'Canonical zapis brisanja nije valjan.' }
    const item = row as Record<string, unknown>
    const manifestId = typeof item.manifest_id === 'string' ? item.manifest_id : typeof item.manifestId === 'string' ? item.manifestId : ''
    const bucket = typeof item.storage_bucket === 'string' ? item.storage_bucket : ''
    const storagePath = typeof item.storage_path === 'string' ? item.storage_path : ''
    const manifestPath = typeof item.manifest_path === 'string' ? item.manifest_path : ''
    if (!manifestId || !bucket || !safePath(storagePath, prefix) || !safePath(manifestPath, prefix)) {
      return { ok: false, error: 'Canonical zapis sadrži nesigurnu putanju privremenog podatka.' }
    }
    result.push({ manifestId, bucket, storagePath, manifestPath })
  }
  return { ok: true, value: result }
}

function safePath(value: string, prefix: string): boolean {
  return value.startsWith(prefix)
    && !value.includes('..')
    && !value.includes('\\')
    && value.split('/').every((segment) => Boolean(segment))
}

function parseAccountPayloadPaths(value: unknown, userId: string): { ok: true; value: PayloadPath[] } | { ok: false; error: string } {
  const rows = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []
  const prefix = `${userId}/`
  const result: PayloadPath[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') return { ok: false, error: 'Canonical account cleanup zapis nije valjan.' }
    const item = row as Record<string, unknown>
    const manifestId = typeof item.manifest_id === 'string' ? item.manifest_id : typeof item.manifestId === 'string' ? item.manifestId : ''
    const bucket = typeof item.storage_bucket === 'string' ? item.storage_bucket : ''
    const storagePath = typeof item.storage_path === 'string' ? item.storage_path : ''
    const manifestPath = typeof item.manifest_path === 'string' ? item.manifest_path : ''
    if (!manifestId || !bucket || !safePath(storagePath, prefix) || !safePath(manifestPath, prefix)) {
      return { ok: false, error: 'Canonical account cleanup sadrži nesigurnu putanju.' }
    }
    result.push({ manifestId, bucket, storagePath, manifestPath })
  }
  return { ok: true, value: result }
}

function failure(status: 'deletion_scheduled' | 'contract_error', error: string, deleted: number): RunPayloadDeletionResult {
  return { ok: false, status, error, deleted }
}

async function scheduleAccountFailure(db: RunPayloadDeletionClient, input: AccountPayloadDeletionInput, error: string): Promise<AccountPayloadDeletionResult> {
  const recorded = await callRpc(db, 'record_user_agent_payload_deletion_failure', {
    p_user_id: input.userId,
    p_error_code: 'storage_delete_failed',
  })
  logOperationalEvent({
    eventName: 'account_agent_payload_cleanup_failed',
    userId: input.userId,
    reason: recorded.error ? 'failure_recording_failed' : 'storage_delete_failed',
    error,
  }, 'error')
  return accountFailure('deletion_scheduled', 'Privremeni podaci nisu uklonjeni; brisanje računa je zaustavljeno i bit će ponovljeno.', 0)
}

function accountFailure(status: 'deletion_scheduled' | 'contract_error', error: string, deleted: number): AccountPayloadDeletionResult {
  return { ok: false, status, error, deleted }
}
