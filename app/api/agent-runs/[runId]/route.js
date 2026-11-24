import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordKatedraProductEvent } from '@/lib/analytics/product-events'
import { cancelAgentRun } from '@/lib/agents/backend-contract'
import { createSupabaseRunPayloadManifestStore } from '@/lib/agents/run-context-loader'
import { loadAgentRunResults } from '@/lib/agents/run-result-storage'
import { privateJson } from '@/lib/observability/private-response.js'
import { logOperationalEvent } from '@/lib/observability/operational-events'
import { getRequestId, withRequestId } from '@/lib/observability/request-id.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'

const ENABLED = process.env.KATEDRA_AGENT_RUNS_ENABLED === 'true'

export async function GET(req, { params }) {
  return withRequestId(await handleGet(req, { params }), getRequestId(req))
}

async function handleGet(req, { params }) {
  if (!ENABLED) return Response.json({ error: 'Agenticni run ugovor još nije aktivan u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const runId = (await params).runId
  const requestedProjectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  const { data: run, error } = await supabase.from('agent_runs')
    .select('run_id, project_id, mode, source_policy, status, created_at, updated_at, payload_cleanup_status, payload_expires_at, payload_deleted_at, payload_cleanup_error')
    .eq('run_id', runId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return Response.json({ error: 'Učitavanje runa nije uspjelo.' }, { status: 503 })
  if (!run) return Response.json({ error: 'Run nije pronađen.' }, { status: 404 })
  if (requestedProjectId && requestedProjectId !== run.project_id) return Response.json({ error: 'Run ne pripada traženom projektu.' }, { status: 403 })
  const { data: steps, error: stepsError } = await supabase.from('agent_steps')
    .select('step_id, agent, verifier, section_id, step_order, attempt, status, provider, usage, last_verification')
    .eq('run_id', runId)
    .order('step_order', { ascending: true })
  if (stepsError) return Response.json({ error: 'Učitavanje koraka nije uspjelo.' }, { status: 503 })
  let results = []
  try {
    const bucket = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'
    const storage = supabase.storage.from(bucket)
    const payloadStorage = {
      async download(path) {
        const downloaded = await storage.download(path)
        if (downloaded.error || !downloaded.data) throw new Error('Privatni rezultat nije moguće učitati.')
        return downloaded.data.arrayBuffer()
      },
    }
    results = await loadAgentRunResults(createSupabaseRunPayloadManifestStore(supabase), payloadStorage, { runId, projectId: run.project_id, userId: user.id, bucket })
  } catch (resultError) {
    logOperationalEvent({ eventName: 'agent_run_result_payload_load_failed', runId, projectId: run.project_id, error: resultError }, 'error')
    return Response.json({ error: 'Rezultate runa trenutno nije moguće učitati.' }, { status: 503 })
  }
  if (run.status === 'completed') {
    try { await recordKatedraProductEvent(createAdminClient(), { eventName: 'agent_run_completed', userId: user.id, projectId: run.project_id, idempotencyKey: run.run_id, properties: { mode: run.mode } }) } catch { /* telemetry never blocks status reads */ }
  }
  return privateJson({ run: { ...run, privacy: privacyStatus(run) }, steps: steps || [], results })
}

function privacyStatus(run) {
  if (run.payload_cleanup_status === 'deleted' || run.payload_deleted_at) return {
    status: 'deleted',
    ...(typeof run.payload_deleted_at === 'string' ? { deletedAt: run.payload_deleted_at } : {}),
  }
  if (run.payload_cleanup_status === 'deletion_scheduled') return {
    status: 'deletion_scheduled',
    ...(typeof run.payload_expires_at === 'string' ? { expiresAt: run.payload_expires_at } : {}),
    ...(typeof run.payload_cleanup_error === 'string' ? { cleanupError: run.payload_cleanup_error } : {}),
  }
  if (run.payload_cleanup_status === 'deletion_failed') return {
    status: 'deletion_failed',
    ...(typeof run.payload_expires_at === 'string' ? { expiresAt: run.payload_expires_at } : {}),
    cleanupError: 'Privremeno brisanje nije završeno; sustav će pokušati ponovo.',
  }
  return {
    status: 'temporarily_uploaded',
    ...(typeof run.payload_expires_at === 'string' ? { expiresAt: run.payload_expires_at } : {}),
  }
}

export async function DELETE(req, { params }) {
  return withRequestId(await handleDelete(req, { params }), getRequestId(req))
}

async function handleDelete(req, { params }) {
  const origin = validateSameOriginRequest(req, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return Response.json({ error: origin.error }, { status: origin.status })
  if (!ENABLED) return Response.json({ error: 'Agenticni run ugovor još nije aktivan u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const runId = (await params).runId
  const cancelled = await cancelAgentRun(supabase, { userId: user.id, runId })
  if (!cancelled.ok) return Response.json({ error: 'Otkazivanje runa nije uspjelo.' }, { status: 503 })
  return privateJson(cancelled.value)
}
