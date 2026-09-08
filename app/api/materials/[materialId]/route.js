import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revokeRunConsent } from '@/lib/agents/revoke-consent'
import { resolveOwnedProjectResult } from '@/lib/academic-suite/repositories/projects'
import { logOperationalEvent } from '@/lib/observability/operational-events'
import { resolveMaterialStorageNames } from '@/lib/materials/storage-paths.js'
import { privateJson } from '@/lib/observability/private-response.js'
import { getRequestId, withRequestId } from '@/lib/observability/request-id.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'

const BUCKET = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'

export async function DELETE(req, { params }) {
  return withRequestId(await handleDelete(req, { params }), getRequestId(req))
}

async function handleDelete(req, { params }) {
  const origin = validateSameOriginRequest(req, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return Response.json({ error: origin.error }, { status: origin.status })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  const materialId = String((await params).materialId || '').trim()
  const materialIdCheck = resolveMaterialStorageNames(materialId, [])
  if (!materialIdCheck.ok && materialIdCheck.status === 400) return Response.json({ error: materialIdCheck.error }, { status: 400 })
  const projectResult = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId })
  if ('error' in projectResult) {
    logOperationalEvent({ eventName: 'material_delete_project_lookup_failed', userId: user.id, projectId, error: projectResult.error }, 'error')
    return Response.json({ error: 'Projekt trenutačno nije moguće provjeriti.' }, { status: 503 })
  }
  const project = projectResult.value
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  let tombstone
  try { tombstone = await supabase.rpc('withdraw_material_payload_consent', {
    p_user_id: user.id,
    p_project_id: project.projectId,
    p_material_id: materialId,
  }) } catch { return privateJson({ error: 'Povlačenje pristanka trenutačno nije dostupno.' }, { status: 503 }) }
  if (tombstone.error) {
    const status = tombstone.error.code === '40901' ? 409
      : tombstone.error.code === 'P0002' ? 404
        : tombstone.error.code === '22023' ? 400
          : tombstone.error.code === '42501' ? 403 : 503
    return Response.json({ error: status === 409 ? 'Materijal je upravo povezan s tijekom. Ponovi povlačenje pristanka.' : status === 404 ? 'Materijal nije pronađen.' : status === 403 ? 'Nemaš pravo brisati ovaj materijal.' : status === 400 ? 'Zahtjev za brisanje materijala nije valjan.' : 'Povlačenje pristanka trenutačno nije dostupno.' }, { status })
  }
  const row = Array.isArray(tombstone.data) ? tombstone.data[0] : tombstone.data
  const paths = resolveTombstonePaths(row, { userId: user.id, projectId: project.projectId, materialId, bucket: BUCKET })
  if (!paths.ok) return Response.json({ error: paths.error }, { status: paths.status })
  const revokedRuns = row.revoked_run_ids
  if (!Array.isArray(revokedRuns) || !revokedRuns.every(id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    || (row.run_id != null && !revokedRuns.includes(row.run_id))) {
    return privateJson({ error: 'Potvrda povlačenja pristanka nije dostupna.' }, { status: 503 })
  }
  const runConsentRevoked = revokedRuns.length > 0
  const pending = () => privateJson({ deletionRequested: materialId, cleanup: 'pending', runConsentRevoked }, { status: 202 })
  try {
    let runsDeleted = true
    for (const runId of new Set(revokedRuns)) {
      // Withdrawal atomically revoked every recorded attachment, including
      // detached/previous runs. Cleanup is idempotent and separately confirmed.
      const result = await revokeRunConsent(supabase, { userId: user.id, projectId: project.projectId, runId }, createAdminClient)
      if (!result.ok || result.cleanup !== 'deleted') runsDeleted = false
    }
    const admin = createAdminClient()
    const confirmedDeleted = async () => {
      const state = await admin.from('agent_payload_manifests').select('content_deleted_at')
        .eq('manifest_id', row.manifest_id).eq('user_id', user.id).eq('project_id', project.projectId).maybeSingle()
      return !state.error && typeof state.data?.content_deleted_at === 'string' && Number.isFinite(Date.parse(state.data.content_deleted_at))
    }
    const ready = await admin.rpc('agent_payload_deletion_ready', { p_manifest_ids: [row.manifest_id] })
    if (ready.error || !Array.isArray(ready.data)) return pending()
    if (ready.data.some(item => item?.manifest_id === row.manifest_id)) {
      const removed = await admin.storage.from(BUCKET).remove(paths.paths)
      if (removed.error) return pending()
      const finalized = await admin.rpc('finalize_agent_payload_deletions', { p_manifest_ids: [row.manifest_id] })
      if (finalized.error) return pending()
    }
    return await confirmedDeleted() && runsDeleted ? privateJson({ deleted: materialId, cleanup: 'deleted', runConsentRevoked }) : pending()
  } catch { return pending() }
}

function resolveTombstonePaths(row, { userId, projectId, materialId, bucket }) {
  if (!row || typeof row !== 'object') return { ok: false, status: 404, error: 'Materijal nije pronađen.' }
  if (String(row.material_id || '') !== materialId || String(row.storage_bucket || '') !== bucket) {
    return { ok: false, status: 503, error: 'Canonical zapis materijala nije valjan.' }
  }
  if (bucket !== 'katedra-temporary-materials' || !/^[0-9a-f-]{36}$/i.test(String(row.manifest_id || ''))) {
    return { ok: false, status: 503, error: 'Canonical zapis materijala nije valjan.' }
  }
  const prefix = `${userId}/${projectId}/`
  const storagePath = String(row.storage_path || '')
  const manifestPath = String(row.manifest_path || '')
  const expectedManifestPath = `${prefix}${materialId}.manifest.json`
  const storageName = storagePath.slice(prefix.length)
  if (!storagePath.startsWith(`${prefix}${materialId}-`)
    || storageName.includes('/')
    || /[\\%\x00-\x1f]/.test(storageName)
    || manifestPath !== expectedManifestPath) {
    return { ok: false, status: 503, error: 'Canonical storage putanja materijala nije valjana.' }
  }
  return { ok: true, paths: [storagePath, manifestPath] }
}
