import { createClient } from '@/lib/supabase/server'
import { readProjectLock, validateLockedProjectMutation } from '@/lib/academic-suite/project-lock'
import { lookupActiveProjectPassForProduct } from '@/lib/academic-suite/repositories/entitlements'
import { productTierForWorkType } from '@/lib/product/lifecycle'
import { createSupabaseRunPayloadManifestStore } from '@/lib/agents/run-context-loader'
import { loadActiveRunContextSnapshot } from '@/lib/agents/run-context-access'
import { loadAgentRunResults } from '@/lib/agents/run-result-storage'
import { storePlanApproval } from '@/lib/agents/run-context-storage'
import { canEditAgentRunContext } from '@/lib/agents/run-context-policy'
import { selectVerifiedAgentArtifacts } from '@/lib/agents/artifact-chain'
import { buildPlanReview, isPlanApprovalCurrent } from '@/lib/agents/plan-approval'
import { privateJson } from '@/lib/observability/private-response.js'
import { getRequestId, withRequestId } from '@/lib/observability/request-id.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'
import { JSON_BODY_LIMITS, readJsonBody } from '@/lib/http/json-body.js'

export const runtime = 'nodejs'

export async function GET(req, context) { return respond(req, context, false) }
export async function POST(req, context) { return respond(req, context, true) }

async function respond(req, context, approve) {
  let response
  try { response = await handle(req, context, approve) }
  catch { response = privateJson({ error: 'Plan trenutno nije moguće učitati ili potvrditi.' }, { status: 503 }) }
  return withRequestId(response, getRequestId(req))
}

async function handle(req, { params }, approve) {
  if (approve) {
    const origin = validateSameOriginRequest(req, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
    if (!origin.ok) return privateJson({ error: origin.error }, { status: origin.status })
  }
  if (process.env.KATEDRA_AGENT_RUNS_ENABLED !== 'true') return privateJson({ error: 'Agentički tijek nije aktivan.' }, { status: 503 })
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return privateJson({ error: 'Prijavi se.' }, { status: 401 })
  const runId = String((await params).runId || '')
  const { data: run, error } = await db.from('agent_runs')
    .select('run_id, project_id, status').eq('run_id', runId).eq('user_id', user.id).maybeSingle()
  if (error) return privateJson({ error: 'Run nije moguće učitati.' }, { status: 503 })
  if (!run) return privateJson({ error: 'Run nije pronađen.' }, { status: 404 })
  if (approve && !canEditAgentRunContext(run.status)) return privateJson({ error: 'Plan potvrdi dok tijek čeka tvoju odluku.' }, { status: 409 })

  let body
  let lock
  if (approve) {
    const parsed = await readJsonBody(req, JSON_BODY_LIMITS.worker)
    if (!parsed.ok) return privateJson({ error: parsed.error }, { status: parsed.status })
    body = parsed.value
    if (body?.projectId !== run.project_id) return privateJson({ error: 'Plan ne pripada projektu.' }, { status: 403 })
    if (body?.approve !== true || !/^[a-f0-9]{64}$/.test(String(body?.planRevision || ''))) return privateJson({ error: 'Potrebna je izričita potvrda prikazane verzije plana.' }, { status: 400 })
    const locked = await readProjectLock(db, { userId: user.id, projectId: run.project_id })
    if (!locked.ok) return privateJson({ error: 'Provjera Passa nije uspjela.' }, { status: 503 })
    lock = locked.lock
    if (!lock) return privateJson({ error: 'Aktivan Pass za ovaj projekt je potreban.' }, { status: 402 })
    const product = productTierForWorkType(lock.workType)
    if (!product || ![product, 'katedra_pass_' + product].includes(lock.productKey)) return privateJson({ error: 'Neispravan opseg Passa.' }, { status: 503 })
    const pass = await lookupActiveProjectPassForProduct(db, { userId: user.id, projectId: run.project_id, productId: 'katedra_pass_' + product })
    if (!pass.ok) return privateJson({ error: 'Provjera Passa nije uspjela.' }, { status: 503 })
    if (!pass.active) return privateJson({ error: 'Aktivan Pass za ovaj projekt je potreban.' }, { status: 402 })
  }

  const bucket = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'
  const storage = db.storage.from(bucket)
  const payloadStorage = { async download(path) {
    const downloaded = await storage.download(path)
    if (downloaded.error || !downloaded.data) throw new Error('Private context unavailable')
    return downloaded.data.arrayBuffer()
  } }
  const manifestStore = createSupabaseRunPayloadManifestStore(db)
  const scope = { runId, projectId: run.project_id, userId: user.id, bucket }
  const { manuscript, contextRevision, planApproval } = await loadActiveRunContextSnapshot(manifestStore, payloadStorage, scope)
  const results = await loadAgentRunResults(manifestStore, payloadStorage, scope)
  const artifacts = selectVerifiedAgentArtifacts(results, { order: Number.MAX_SAFE_INTEGER, projectId: run.project_id, runId })
  const review = buildPlanReview(manuscript, artifacts)
  if (!approve) return privateJson({ ...review,
    sectionTitles: Object.fromEntries(manuscript.sections.map((section) => [section.id, section.title])),
    sourceLabels: Object.fromEntries(manuscript.sources.map((source) => [source.id, [source.authors, source.title, source.year].filter(Boolean).join(', ')])),
    approved: review.ready && isPlanApprovalCurrent(planApproval, {
    userId: user.id, projectId: run.project_id, runId, planRevision: review.planRevision,
  }) })
  const mutation = validateLockedProjectMutation(lock, { topic: manuscript.title, workType: manuscript.workType })
  if (!mutation.ok) return privateJson({ error: mutation.error }, { status: mutation.status })
  if (!review.ready || body.planRevision !== review.planRevision) return privateJson({ error: 'Plan se promijenio ili još nije spreman. Ponovno ga pregledaj.' }, { status: 409 })
  const approval = { schemaVersion: 1, runId, projectId: run.project_id, planRevision: review.planRevision, approvedBy: user.id, approvedAt: new Date().toISOString() }
  const stored = await storePlanApproval(db, { userId: user.id, projectId: run.project_id, runId, contextRevision, planApproval: approval, bucket })
  if (!stored.ok) return privateJson({ error: stored.error }, { status: stored.status })
  return privateJson({ approved: true, planRevision: review.planRevision })
}
