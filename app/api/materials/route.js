import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOwnedProject } from '@/lib/academic-suite/repositories/projects'
import { createMaterialProvider } from '@/lib/materials/provider'
import { MATERIAL_LIMITS } from '@/lib/materials/extractors'
import { registerAgentPayload } from '@/lib/agents/backend-contract'
import { resolveProjectCapability } from '@/lib/product/server-capabilities'
import { isDistributedRateLimitConfigured, reserveDistributedRequest, reserveUserRequest } from '@/lib/ai/rate-limit'
import { createRequestContext, withRequestId } from '@/lib/observability/request-id.js'

const ENABLED = process.env.KATEDRA_MATERIALS_ENABLED === 'true'
const BUCKET = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'
const KINDS = new Set(['draft', 'source', 'mentor', 'rules', 'notes', 'scan'])
const MULTIPART_OVERHEAD_BYTES = 1 * 1024 * 1024

export async function POST(req) {
  const requestContext = createRequestContext(req)
  return withRequestId(await handlePost(req, requestContext), requestContext.traceRequestId)
}

async function handlePost(req, requestContext) {
  const { traceRequestId, reservationRequestId } = requestContext
  if (!ENABLED) return Response.json({ error: 'Privremena pohrana materijala još nije aktivna u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  const contentLength = Number(req.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > MATERIAL_LIMITS.maxBytes + MULTIPART_OVERHEAD_BYTES) {
    return Response.json({ error: 'Datoteka je prevelika.' }, { status: 413 })
  }
  const distributedRateLimit = isDistributedRateLimitConfigured()
  if (process.env.NODE_ENV === 'production' && !distributedRateLimit) {
    console.error(JSON.stringify({ eventName: 'material_rate_limit_store_unavailable', userId: user.id, requestId: traceRequestId }))
    return Response.json({ error: 'Ograničavanje upload zahtjeva još nije konfigurirano.' }, { status: 503 })
  }
  const reservation = distributedRateLimit
    ? await reserveDistributedRequest(createAdminClient(), { userId: user.id, requestId: reservationRequestId, estimatedCharge: 0 })
    : reserveUserRequest(user.id)
  if (!reservation.allowed) {
    return Response.json({
      error: reservation.reason === 'concurrency'
        ? 'Već obrađujem jedan materijal — pričekaj da završi.'
        : reservation.reason === 'rate'
          ? 'Previše uploadova — pričekaj minutu.'
          : 'Ograničavanje upload zahtjeva trenutno nije dostupno.',
    }, { status: reservation.reason === 'unavailable' ? 503 : 429 })
  }

  try {
    const form = await req.formData().catch(() => null)
  const projectId = String(form?.get('projectId') || '').trim()
  const kind = String(form?.get('kind') || 'notes')
  const file = form?.get('file')
  if (!projectId || !KINDS.has(kind) || !file || typeof file.arrayBuffer !== 'function') {
    return Response.json({ error: 'Nedostaje projekt, vrsta materijala ili datoteka.' }, { status: 400 })
  }
  if (typeof file.size === 'number' && file.size > MATERIAL_LIMITS.maxBytes) {
    return Response.json({ error: 'Datoteka je prevelika.' }, { status: 413 })
  }

  const project = await resolveOwnedProject(supabase, { userId: user.id, projectId })
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const decision = await resolveProjectCapability(supabase, {
    userId: user.id,
    projectId: project.projectId,
    capability: 'section_writing',
  })
  if (!decision.allowed) {
    const status = decision.code === 'pass_required' ? 402
      : decision.code === 'project_not_owned' ? 404
        : decision.code === 'unauthenticated' ? 401 : 503
    return Response.json({ error: 'Upload materijala zahtijeva aktivan Pass za ovaj projekt.' }, { status })
  }

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
  } finally {
    await Promise.resolve(reservation.release()).catch((error) => {
      console.error(JSON.stringify({ eventName: 'material_rate_limit_release_failed', userId: user.id, requestId: traceRequestId, reservationRequestId, error: error?.message }))
    })
  }
}

export async function GET(req) {
  if (!ENABLED) return Response.json({ error: 'Privremena pohrana materijala još nije aktivna u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  const project = await resolveOwnedProject(supabase, { userId: user.id, projectId })
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const decision = await resolveProjectCapability(supabase, {
    userId: user.id,
    projectId: project.projectId,
    capability: 'section_writing',
  })
  if (!decision.allowed) return Response.json({ error: 'Materijali su dostupni samo u aktivnom Pass projektu.' }, { status: decision.code === 'pass_required' ? 402 : 503 })
  const prefix = `${user.id}/${project.projectId}`
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100 })
  if (error) return Response.json({ error: 'Učitavanje materijala nije uspjelo.' }, { status: 503 })
  const materials = await Promise.all((data || []).filter((entry) => entry.name.endsWith('.manifest.json')).map(async (entry) => {
    const materialId = entry.name.slice(0, -'.manifest.json'.length)
    const downloaded = await supabase.storage.from(BUCKET).download(`${prefix}/${entry.name}`)
    if (downloaded.error) return null
    try {
      const value = JSON.parse(await downloaded.data.text())
      return isActiveMaterial(value, project.projectId, materialId) ? value : null
    } catch { return null }
  }))
  return Response.json({ materials: materials.filter(Boolean).filter((value) => isActiveMaterial(value)) })
}

function isActiveMaterial(value, expectedProjectId, expectedMaterialId) {
  if (!value || typeof value !== 'object' || typeof value.expiresAt !== 'string') return false
  if (expectedProjectId !== undefined && value.projectId !== expectedProjectId) return false
  if (expectedMaterialId !== undefined && value.id !== expectedMaterialId) return false
  const expiresAt = Date.parse(value.expiresAt)
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}
