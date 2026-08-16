import { createClient } from '@/lib/supabase/server'
import { resolveOwnedProjectResult } from '@/lib/academic-suite/repositories/projects'
import { resolveMaterialStorageNames } from '@/lib/materials/storage-paths.js'
import { privateJson } from '@/lib/observability/private-response.js'
import { getRequestId, withRequestId } from '@/lib/observability/request-id.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'

const ENABLED = process.env.KATEDRA_MATERIALS_ENABLED === 'true'
const DELETION_CONTRACT_ENABLED = process.env.KATEDRA_MATERIAL_DELETE_RPC_CONTRACT === 'v1'
const BUCKET = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'

export async function DELETE(req, { params }) {
  return withRequestId(await handleDelete(req, { params }), getRequestId(req))
}

async function handleDelete(req, { params }) {
  const origin = validateSameOriginRequest(req, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return Response.json({ error: origin.error }, { status: origin.status })
  if (!DELETION_CONTRACT_ENABLED) return Response.json({ error: 'Brisanje materijala još nije aktivno na canonical backendu.' }, { status: 503 })
  if (!ENABLED) return Response.json({ error: 'Privremena pohrana materijala još nije aktivna u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  const materialId = String((await params).materialId || '').trim()
  const materialIdCheck = resolveMaterialStorageNames(materialId, [])
  if (!materialIdCheck.ok && materialIdCheck.status === 400) return Response.json({ error: materialIdCheck.error }, { status: 400 })
  const projectResult = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId })
  if ('error' in projectResult) {
    console.error(JSON.stringify({ eventName: 'material_delete_project_lookup_failed', userId: user.id, projectId, error: projectResult.error }))
    return Response.json({ error: 'Projekt trenutačno nije moguće provjeriti.' }, { status: 503 })
  }
  const project = projectResult.value
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const tombstone = await supabase.rpc('tombstone_agent_payload', {
    p_user_id: user.id,
    p_project_id: project.projectId,
    p_material_id: materialId,
  })
  if (tombstone.error) {
    const status = tombstone.error.code === '40901' ? 409
      : tombstone.error.code === 'P0002' ? 404
        : tombstone.error.code === '22023' ? 400
          : tombstone.error.code === '42501' ? 403 : 503
    return Response.json({ error: status === 409 ? 'Materijal je vezan uz aktivni tijek i trenutačno ga nije moguće obrisati.' : status === 404 ? 'Materijal nije pronađen.' : status === 403 ? 'Nemaš pravo brisati ovaj materijal.' : status === 400 ? 'Zahtjev za brisanje materijala nije valjan.' : 'Canonical brisanje materijala nije dostupno.' }, { status })
  }
  const row = Array.isArray(tombstone.data) ? tombstone.data[0] : tombstone.data
  const paths = resolveTombstonePaths(row, { userId: user.id, projectId: project.projectId, materialId, bucket: BUCKET })
  if (!paths.ok) return Response.json({ error: paths.error }, { status: paths.status })
  const removed = await supabase.storage.from(BUCKET).remove(paths.paths)
  if (removed.error) {
    return Response.json({ error: 'Materijal je označen za brisanje, ali privatni objekt još nije uklonjen. Pokušaj ponovno.' }, { status: 503 })
  }
  return privateJson({ deleted: materialId })
}

function resolveTombstonePaths(row, { userId, projectId, materialId, bucket }) {
  if (!row || typeof row !== 'object') return { ok: false, status: 404, error: 'Materijal nije pronađen.' }
  if (String(row.material_id || '') !== materialId || String(row.storage_bucket || '') !== bucket) {
    return { ok: false, status: 503, error: 'Canonical zapis materijala nije valjan.' }
  }
  const prefix = `${userId}/${projectId}/`
  const storagePath = String(row.storage_path || '')
  const manifestPath = String(row.manifest_path || '')
  const expectedManifestPath = `${prefix}${materialId}.manifest.json`
  const storageName = storagePath.slice(prefix.length)
  if (!storagePath.startsWith(`${prefix}${materialId}-`)
    || storageName.includes('/')
    || manifestPath !== expectedManifestPath) {
    return { ok: false, status: 503, error: 'Canonical storage putanja materijala nije valjana.' }
  }
  return { ok: true, paths: [storagePath, manifestPath] }
}
