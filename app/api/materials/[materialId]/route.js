import { createClient } from '@/lib/supabase/server'
import { resolveOwnedProject } from '@/lib/academic-suite/repositories/projects'
import { resolveProjectCapability } from '@/lib/product/server-capabilities'
import { resolveMaterialStorageNames } from '@/lib/materials/storage-paths.js'

const ENABLED = process.env.KATEDRA_MATERIALS_ENABLED === 'true'
const BUCKET = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'

export async function DELETE(req, { params }) {
  if (!ENABLED) return Response.json({ error: 'Privremena pohrana materijala još nije aktivna u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  const materialId = String((await params).materialId || '').trim()
  const materialIdCheck = resolveMaterialStorageNames(materialId, [])
  if (!materialIdCheck.ok && materialIdCheck.status === 400) return Response.json({ error: materialIdCheck.error }, { status: 400 })
  const project = await resolveOwnedProject(supabase, { userId: user.id, projectId })
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const decision = await resolveProjectCapability(supabase, {
    userId: user.id,
    projectId: project.projectId,
    capability: 'section_writing',
  })
  if (!decision.allowed) return Response.json({ error: 'Materijali su dostupni samo u aktivnom Pass projektu.' }, { status: decision.code === 'pass_required' ? 402 : 503 })
  const storage = supabase.storage.from(BUCKET)
  const listed = await storage.list(`${user.id}/${project.projectId}`, { limit: 100 })
  if (listed.error) return Response.json({ error: 'Učitavanje materijala nije uspjelo.' }, { status: 503 })
  const resolved = resolveMaterialStorageNames(materialId, (listed.data || []).map((entry) => entry.name))
  if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status })
  const removed = await storage.remove(resolved.names.map((name) => `${user.id}/${project.projectId}/${name}`))
  if (removed.error) return Response.json({ error: 'Brisanje materijala nije uspjelo.' }, { status: 503 })
  return Response.json({ deleted: materialId })
}
