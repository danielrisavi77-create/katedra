import { createClient } from '@/lib/supabase/server'
import { resolveOwnedProject } from '@/lib/academic-suite/repositories/projects'

const ENABLED = process.env.KATEDRA_MATERIALS_ENABLED === 'true'
const BUCKET = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'

export async function DELETE(req, { params }) {
  if (!ENABLED) return Response.json({ error: 'Privremena pohrana materijala još nije aktivna u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  const materialId = (await params).materialId
  const project = await resolveOwnedProject(supabase, { userId: user.id, projectId })
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const storage = supabase.storage.from(BUCKET)
  const prefix = `${user.id}/${project.projectId}/${materialId}`
  const listed = await storage.list(`${user.id}/${project.projectId}`, { limit: 100 })
  if (listed.error) return Response.json({ error: 'Učitavanje materijala nije uspjelo.' }, { status: 503 })
  const names = (listed.data || []).map((entry) => entry.name).filter((name) => name.startsWith(materialId))
  if (!names.length) return Response.json({ error: 'Materijal nije pronađen.' }, { status: 404 })
  const removed = await storage.remove(names.map((name) => `${user.id}/${project.projectId}/${name}`))
  if (removed.error) return Response.json({ error: 'Brisanje materijala nije uspjelo.' }, { status: 503 })
  return Response.json({ deleted: materialId })
}
