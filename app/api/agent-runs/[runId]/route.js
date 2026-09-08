import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revokeRunConsent } from '@/lib/agents/revoke-consent'
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
    .select('run_id, project_id, mode, source_policy, status, created_at, updated_at')
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
  return privateJson({ run, steps: steps || [], results })
}

export async function DELETE(req, { params }) {
  return withRequestId(await handleDelete(req, { params }), getRequestId(req))
}

async function handleDelete(req, { params }) {
  const origin = validateSameOriginRequest(req, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return Response.json({ error: origin.error }, { status: origin.status })
  // Privacy withdrawal remains available after Pass expiry or feature shutdown.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const runId = (await params).runId
  const requestedProjectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  const { data: run, error } = await supabase.from('agent_runs')
    .select('run_id, project_id').eq('run_id', runId).eq('user_id', user.id).maybeSingle()
  if (error) return privateJson({ error: 'Run trenutačno nije moguće provjeriti.' }, { status: 503 })
  if (!run) return privateJson({ error: 'Run nije pronađen.' }, { status: 404 })
  if (requestedProjectId && requestedProjectId !== run.project_id) return privateJson({ error: 'Run ne pripada traženom projektu.' }, { status: 403 })
  const result = await revokeRunConsent(supabase, { userId: user.id, projectId: run.project_id, runId }, createAdminClient)
  if (!result.ok) return privateJson({ error: 'Povlačenje pristanka nije uspjelo. Pokušaj ponovno.' }, { status: 503 })
  return privateJson({ runId, consentRevoked: true, cleanup: result.cleanup }, { status: result.cleanup === 'pending' ? 202 : 200 })
}
