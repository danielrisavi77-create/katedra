import { createClient } from '@/lib/supabase/server'
import { resolveOwnedProject } from '@/lib/academic-suite/repositories/projects'
import { readProjectLock } from '@/lib/academic-suite/project-lock'
import { createMaterialProvider } from '@/lib/materials/provider'
import { registerAgentPayload } from '@/lib/agents/backend-contract'

const ENABLED = process.env.KATEDRA_MATERIALS_ENABLED === 'true'
const BUCKET = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'
const KINDS = new Set(['draft', 'source', 'mentor', 'rules', 'notes', 'scan'])

export async function POST(req) {
  if (!ENABLED) return Response.json({ error: 'Privremena pohrana materijala još nije aktivna u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const projectId = String(form?.get('projectId') || '').trim()
  const kind = String(form?.get('kind') || 'notes')
  const file = form?.get('file')
  if (!projectId || !KINDS.has(kind) || !file || typeof file.arrayBuffer !== 'function') {
    return Response.json({ error: 'Nedostaje projekt, vrsta materijala ili datoteka.' }, { status: 400 })
  }

  const project = await resolveOwnedProject(supabase, { userId: user.id, projectId })
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const lock = await readProjectLock(supabase, { userId: user.id, projectId: project.projectId })
  if (!lock.ok) return Response.json({ error: 'Provjera Passa nije uspjela.' }, { status: 503 })
  if (!lock.lock) return Response.json({ error: 'Aktivan Pass za ovaj projekt je potreban.' }, { status: 402 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const materialId = crypto.randomUUID()
  const provider = createMaterialProvider()
  const asset = await provider.extract({
    id: materialId,
    projectId: project.projectId,
    kind,
    name: String(file.name || 'materijal'),
    mimeType: String(file.type || 'application/octet-stream'),
    buffer,
  })
  if (asset.extractionStatus === 'failed') return Response.json({ error: asset.warnings[0] || 'Ekstrakcija nije uspjela.', asset }, { status: 422 })

  const safeName = asset.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'materijal'
  const prefix = `${user.id}/${project.projectId}/${materialId}`
  const storagePath = `${prefix}-${safeName}`
  const storage = supabase.storage.from(BUCKET)
  const upload = await storage.upload(storagePath, buffer, { contentType: asset.mimeType, upsert: false })
  if (upload.error) return Response.json({ error: 'Privremena pohrana datoteke nije uspjela.' }, { status: 503 })
  const manifestPath = `${prefix}.manifest.json`
  const manifest = await storage.upload(manifestPath, Buffer.from(JSON.stringify(asset)), { contentType: 'application/json', upsert: false })
  if (manifest.error) {
    await storage.remove([storagePath])
    return Response.json({ error: 'Spremanje statusa materijala nije uspjelo.' }, { status: 503 })
  }
  const registered = await registerAgentPayload(supabase, {
    userId: user.id,
    projectId: project.projectId,
    runId: String(form?.get('runId') || '').trim() || undefined,
    materialId,
    storageBucket: BUCKET,
    storagePath,
    manifestPath,
    expiresAt: asset.expiresAt,
  })
  if (!registered.ok) {
    await storage.remove([storagePath, manifestPath])
    console.error('canonical register_agent_payload failed', { userId: user.id, projectId: project.projectId, error: registered.error })
    return Response.json({ error: 'Registracija privremenog materijala nije uspjela.' }, { status: 503 })
  }
  return Response.json({ asset, storagePath, manifestPath, manifestId: registered.value.manifestId, expiresAt: asset.expiresAt })
}

export async function GET(req) {
  if (!ENABLED) return Response.json({ error: 'Privremena pohrana materijala još nije aktivna u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  const project = await resolveOwnedProject(supabase, { userId: user.id, projectId })
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const prefix = `${user.id}/${project.projectId}`
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100 })
  if (error) return Response.json({ error: 'Učitavanje materijala nije uspjelo.' }, { status: 503 })
  const materials = await Promise.all((data || []).filter((entry) => entry.name.endsWith('.manifest.json')).map(async (entry) => {
    const downloaded = await supabase.storage.from(BUCKET).download(`${prefix}/${entry.name}`)
    if (downloaded.error) return null
    try { return JSON.parse(await downloaded.data.text()) } catch { return null }
  }))
  return Response.json({ materials: materials.filter(Boolean) })
}
