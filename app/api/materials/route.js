import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOwnedProjectResult } from '@/lib/academic-suite/repositories/projects'
import { createMaterialProvider } from '@/lib/materials/provider'
import { MATERIAL_LIMITS } from '@/lib/materials/extractors'
import { registerAgentPayload } from '@/lib/agents/backend-contract'
import { resolveCanonicalProjectPass } from '@/lib/product/server-capabilities'
import { isDistributedRateLimitConfigured, releaseRateLimitReservation, reserveDistributedRequest, reserveUserRequest } from '@/lib/ai/rate-limit'
import { createRequestContext, withRequestId } from '@/lib/observability/request-id.js'
import { privateJson } from '@/lib/observability/private-response.js'
import { mapWithConcurrency } from '@/lib/async/map-limited'
import { readMultipartForm } from '@/lib/http/multipart.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'

const ENABLED = process.env.KATEDRA_MATERIALS_ENABLED === 'true'
const BUCKET = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'
const KINDS = new Set(['draft', 'source', 'mentor', 'rules', 'notes', 'scan'])
const MAX_ACTIVE_MATERIALS = 100
const MAX_MANIFEST_BYTES = 1 * 1024 * 1024
const MAX_TOTAL_MANIFEST_BYTES = 8 * 1024 * 1024
const MAX_PUBLIC_RESPONSE_BYTES = 512 * 1024

export async function POST(req) {
  const requestContext = createRequestContext(req)
  return withRequestId(await handlePost(req, requestContext), requestContext.traceRequestId)
}

async function handlePost(req, requestContext) {
  const origin = validateSameOriginRequest(req, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return Response.json({ error: origin.error }, { status: origin.status })
  const { traceRequestId, reservationRequestId } = requestContext
  if (!ENABLED) return Response.json({ error: 'Privremena pohrana materijala još nije aktivna u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  const distributedRateLimit = isDistributedRateLimitConfigured()
  if (process.env.NODE_ENV === 'production' && !distributedRateLimit) {
    console.error(JSON.stringify({ eventName: 'material_rate_limit_store_unavailable', userId: user.id, requestId: traceRequestId }))
    return Response.json({ error: 'Ograničavanje upload zahtjeva još nije konfigurirano.' }, { status: 503 })
  }
  let reservation
  try {
    reservation = distributedRateLimit
      ? await reserveDistributedRequest(createAdminClient(), { userId: user.id, requestId: reservationRequestId, estimatedCharge: 0 })
      : reserveUserRequest(user.id)
  } catch (error) {
    console.error(JSON.stringify({
      eventName: 'material_rate_limit_reservation_failed',
      userId: user.id,
      requestId: traceRequestId,
      error: error instanceof Error ? error.message : 'unknown admin client error',
    }))
    return Response.json({ error: 'Ograničavanje upload zahtjeva trenutno nije dostupno.' }, { status: 503 })
  }
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
  const form = await readMultipartForm(req, { maxBytes: MATERIAL_LIMITS.maxBytes + 1 * 1024 * 1024, maxFileBytes: MATERIAL_LIMITS.maxBytes })
  if (!form.ok) return Response.json({ error: form.error }, { status: form.status })
  const projectId = String(form.fields.projectId || '').trim()
  const kind = String(form.fields.kind || 'notes')
  const file = form.file
  if (!projectId || !KINDS.has(kind) || !file || !Buffer.isBuffer(file.buffer)) {
    return Response.json({ error: 'Nedostaje projekt, vrsta materijala ili datoteka.' }, { status: 400 })
  }
  if (typeof file.size === 'number' && file.size > MATERIAL_LIMITS.maxBytes) {
    return Response.json({ error: 'Datoteka je prevelika.' }, { status: 413 })
  }

  const projectResult = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId })
  if ('error' in projectResult) {
    console.error(JSON.stringify({ eventName: 'material_project_lookup_failed', userId: user.id, projectId, error: projectResult.error }))
    return Response.json({ error: 'Projekt trenutačno nije moguće provjeriti.' }, { status: 503 })
  }
  const project = projectResult.value
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const decision = await resolveCanonicalProjectPass(supabase, {
    userId: user.id,
    projectId: project.projectId,
  })
  if (!decision.allowed) {
    const status = decision.code === 'pass_required' ? 402
      : 503
    return Response.json({ error: 'Upload materijala zahtijeva aktivan Pass za ovaj projekt.' }, { status })
  }

  const buffer = file.buffer
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
  if (asset.extractionStatus === 'failed') return privateJson({ error: asset.warnings[0] || 'Ekstrakcija nije uspjela.', asset }, { status: 422 })

  const safeName = asset.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'materijal'
  const prefix = `${user.id}/${project.projectId}/${materialId}`
  const storagePath = `${prefix}-${safeName}`
  const storage = supabase.storage.from(BUCKET)
  const upload = await storage.upload(storagePath, buffer, { contentType: asset.mimeType, upsert: false })
  if (upload.error) return Response.json({ error: 'Privremena pohrana datoteke nije uspjela.' }, { status: 503 })
  const manifestPath = `${prefix}.manifest.json`
  const manifest = await storage.upload(manifestPath, Buffer.from(JSON.stringify(asset)), { contentType: 'application/json', upsert: false })
  if (manifest.error) {
    await removeTemporaryObjects(storage, [storagePath], { userId: user.id, projectId: project.projectId, materialId, reason: 'manifest_upload_failed' })
    return Response.json({ error: 'Spremanje statusa materijala nije uspjelo.' }, { status: 503 })
  }
  const registered = await registerAgentPayload(supabase, {
    userId: user.id,
    projectId: project.projectId,
    runId: String(form.fields.runId || '').trim() || undefined,
    materialId,
    storageBucket: BUCKET,
    storagePath,
    manifestPath,
    expiresAt: asset.expiresAt,
  })
  if (!registered.ok) {
    await removeTemporaryObjects(storage, [storagePath, manifestPath], { userId: user.id, projectId: project.projectId, materialId, reason: 'payload_registration_failed' })
    console.error('canonical register_agent_payload failed', { userId: user.id, projectId: project.projectId, error: registered.error })
    return Response.json({ error: 'Registracija privremenog materijala nije uspjela.' }, { status: 503 })
  }
  return privateJson({ asset, storagePath, manifestPath, manifestId: registered.value.manifestId, expiresAt: asset.expiresAt })
  } finally {
    await releaseRateLimitReservation(reservation, (error, attempt) => {
      console.error(JSON.stringify({ eventName: 'material_rate_limit_release_failed', attempt, userId: user.id, requestId: traceRequestId, reservationRequestId, error: error?.message }))
    })
  }
}

export async function GET(req) {
  const requestContext = createRequestContext(req)
  return withRequestId(await handleGet(req), requestContext.traceRequestId)
}

async function handleGet(req) {
  if (!ENABLED) return Response.json({ error: 'Privremena pohrana materijala još nije aktivna u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  const projectResult = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId })
  if ('error' in projectResult) {
    console.error(JSON.stringify({ eventName: 'material_list_project_lookup_failed', userId: user.id, projectId, error: projectResult.error }))
    return Response.json({ error: 'Projekt trenutačno nije moguće provjeriti.' }, { status: 503 })
  }
  const project = projectResult.value
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const decision = await resolveCanonicalProjectPass(supabase, {
    userId: user.id,
    projectId: project.projectId,
  })
  if (!decision.allowed) return Response.json({ error: 'Materijali su dostupni samo u aktivnom Pass projektu.' }, { status: decision.code === 'pass_required' ? 402 : 503 })
  const { data: manifests, error } = await supabase.rpc('list_active_agent_payloads', {
    p_user_id: user.id,
    p_project_id: project.projectId,
  })
  if (error) return Response.json({ error: 'Učitavanje materijala nije uspjelo.' }, { status: 503 })
  const prefix = `${user.id}/${project.projectId}/`
  const activeManifests = Array.isArray(manifests) ? manifests : []
  if (activeManifests.length > MAX_ACTIVE_MATERIALS) {
    return privateJson({ error: 'Popis materijala je prevelik za sigurno učitavanje.' }, { status: 413 })
  }
  let loadedManifestBytes = 0
  const materials = await mapWithConcurrency(activeManifests, 8, async (manifest) => {
    if (!manifest || typeof manifest !== 'object') return null
    const materialId = typeof manifest.material_id === 'string' ? manifest.material_id : ''
    const manifestPath = typeof manifest.manifest_path === 'string' ? manifest.manifest_path : ''
    if (!materialId || manifest.storage_bucket !== BUCKET || manifestPath !== `${prefix}${materialId}.manifest.json`) return null
    const downloaded = await supabase.storage.from(BUCKET).download(manifestPath)
    if (downloaded.error || !downloaded.data) return null
    const manifestBytes = Number(downloaded.data.size)
    if (Number.isFinite(manifestBytes) && (manifestBytes > MAX_MANIFEST_BYTES || loadedManifestBytes + manifestBytes > MAX_TOTAL_MANIFEST_BYTES)) return null
    if (Number.isFinite(manifestBytes)) loadedManifestBytes += manifestBytes
    try {
      const value = JSON.parse(await downloaded.data.text())
      return isActiveMaterial(value, project.projectId, materialId) ? value : null
    } catch { return null }
  })
  const publicMaterials = materials
    .filter(Boolean)
    .filter((value) => isActiveMaterial(value))
    .map(toPublicMaterial)
  const payload = { materials: publicMaterials }
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_PUBLIC_RESPONSE_BYTES) {
    return privateJson({ error: 'Popis materijala je prevelik za sigurno učitavanje.' }, { status: 413 })
  }
  return privateJson(payload)
}

function toPublicMaterial(value) {
  const { extractedText, ...metadata } = value
  void extractedText
  return metadata
}

async function removeTemporaryObjects(storage, paths, context) {
  let lastError
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await storage.remove(paths)
      if (!result?.error) return true
      lastError = result.error
    } catch (error) {
      lastError = error
    }
  }
  console.error(JSON.stringify({
    eventName: 'material_storage_cleanup_failed',
    ...context,
    error: lastError?.message || 'unknown',
  }))
  return false
}

function isActiveMaterial(value, expectedProjectId, expectedMaterialId) {
  if (!value || typeof value !== 'object' || typeof value.expiresAt !== 'string') return false
  if (expectedProjectId !== undefined && value.projectId !== expectedProjectId) return false
  if (expectedMaterialId !== undefined && value.id !== expectedMaterialId) return false
  const expiresAt = Date.parse(value.expiresAt)
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}
