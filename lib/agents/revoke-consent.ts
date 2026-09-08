interface Database {
  rpc: (name: string, params: Record<string, unknown>) => PromiseLike<{ data?: unknown; error?: unknown }>
}
interface Admin extends Database {
  storage: { from: (bucket: string) => { remove: (paths: string[]) => PromiseLike<{ error?: unknown }> } }
}
interface Scope { userId: string; projectId: string; runId: string }
interface Manifest { manifest_id: string; storage_bucket: string; storage_path: string; manifest_path: string }

function validManifest(value: unknown, scope: Scope): value is Manifest {
  if (!value || typeof value !== 'object') return false
  const m = value as Manifest
  if (!m.manifest_id || m.storage_bucket !== 'katedra-temporary-materials') return false
  const prefix = `${scope.userId}/${scope.projectId}/${scope.runId}/`
  if (typeof m.storage_path !== 'string' || !m.storage_path.startsWith(prefix)) return false
  const relative = m.storage_path.slice(prefix.length)
  const valid = relative === 'manuscript-context.json'
    || /^contexts\/[0-9a-f-]{36}\/manuscript-context\.json$/.test(relative)
    || /^results\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.json$/.test(relative)
  return valid && m.manifest_path === `${m.storage_path.slice(0, -5)}.manifest.json`
}

// Revocation commits before privileged Storage access. A failed physical cleanup
// stays in the canonical retry queue and must never be presented as completed.
export async function revokeRunConsent(db: Database, scope: Scope, createAdmin: () => Admin): Promise<
  { ok: false } | { ok: true; cleanup: 'deleted' | 'pending' }
> {
  const params = { p_user_id: scope.userId, p_project_id: scope.projectId, p_run_id: scope.runId }
  let rows: unknown[]
  try {
    const result = await db.rpc('revoke_agent_run_consent', params)
    if (result.error || !Array.isArray(result.data)) return { ok: false }
    rows = result.data
  } catch { return { ok: false } }
  if (!rows.length) return { ok: true, cleanup: 'deleted' }
  let pending = false
  try {
    const admin = createAdmin()
    const ready = await admin.rpc('agent_payload_deletion_ready', { p_manifest_ids: rows.filter((row): row is Manifest => validManifest(row, scope)).map(row => row.manifest_id) })
    if (ready.error || !Array.isArray(ready.data)) return { ok: true, cleanup: 'pending' }
    const readyIds = new Set(ready.data.map(row => row?.manifest_id))
    const deletedIds: string[] = []
    for (const row of rows) {
      if (!validManifest(row, scope)) { pending = true; continue }
      if (!readyIds.has(row.manifest_id)) { pending = true; continue }
      try {
        const result = await admin.storage.from(row.storage_bucket).remove([row.storage_path, row.manifest_path])
        if (result.error) pending = true
        else deletedIds.push(row.manifest_id)
      } catch { pending = true }
    }
    if (deletedIds.length) {
      const result = await admin.rpc('finalize_agent_run_payload_deletion', { ...params, p_manifest_ids: deletedIds })
      if (result.error) pending = true
    }
    if (!pending) {
      // A concurrent finalizer may legitimately affect zero rows. Confirm the
      // canonical terminal state instead of inferring it from a removal count.
      const confirmation = await db.rpc('revoke_agent_run_consent', params)
      if (confirmation.error || !Array.isArray(confirmation.data) || confirmation.data.length) pending = true
    }
  } catch { pending = true }
  return { ok: true, cleanup: pending ? 'pending' : 'deleted' }
}
