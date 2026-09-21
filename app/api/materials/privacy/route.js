import { createClient } from '@/lib/supabase/server'
import { resolveOwnedProjectResult } from '@/lib/academic-suite/repositories/projects'
import { privateJson } from '@/lib/observability/private-response.js'
import { getRequestId, withRequestId } from '@/lib/observability/request-id.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export async function GET(req) {
  return withRequestId(await listPrivacy(req), getRequestId(req))
}

async function listPrivacy(req) {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return privateJson({ error: 'Prijavi se.' }, { status: 401 })
    const query = new URL(req.url).searchParams
    const projectId = query.get('projectId')?.trim() || ''
    const after = query.get('after') || null
    if (!projectId || (after && !UUID.test(after))) return privateJson({ error: 'Zahtjev nije valjan.' }, { status: 400 })
    const project = await resolveOwnedProjectResult(db, { userId: user.id, projectId })
    if ('error' in project) return privateJson({ error: 'Projekt trenutačno nije moguće provjeriti.' }, { status: 503 })
    if (!project.value) return privateJson({ error: 'Projekt nije pronađen.' }, { status: 404 })
    const result = await db.rpc('list_material_payload_privacy', {
      p_user_id: user.id, p_project_id: project.value.projectId, p_after: after,
    })
    if (result.error || !Array.isArray(result.data) || result.data.length > 101) throw new Error('metadata_unavailable')
    const materials = result.data.map(row => {
      if (!row || !UUID.test(row.material_id) || !UUID.test(row.manifest_id)
        || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))
        || typeof row.expires_at !== 'string' || !Number.isFinite(Date.parse(row.expires_at))
        || !['retained', 'pending'].includes(row.cleanup)) throw new Error('invalid_metadata')
      return { materialId: row.material_id, manifestId: row.manifest_id, createdAt: row.created_at, expiresAt: row.expires_at, cleanup: row.cleanup }
    })
    return privateJson({ materials: materials.slice(0, 100), nextCursor: materials.length > 100 ? materials[99].manifestId : null })
  } catch {
    return privateJson({ error: 'Pregled privremene pohrane trenutačno nije dostupan.' }, { status: 503 })
  }
}
