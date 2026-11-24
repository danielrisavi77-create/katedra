import { createClient } from '@/lib/supabase/server'
import { deleteAgentRunPayloads } from '@/lib/agents/run-payload-deletion'
import { privateJson } from '@/lib/observability/private-response.js'
import { logOperationalEvent } from '@/lib/observability/operational-events'
import { getRequestId, withRequestId } from '@/lib/observability/request-id.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'

const ENABLED = process.env.KATEDRA_AGENT_RUNS_ENABLED === 'true'

export async function GET(req, { params }) {
  return withRequestId(await handleGet(req, { params }), getRequestId(req))
}

export async function DELETE(req, { params }) {
  return withRequestId(await handleDelete(req, { params }), getRequestId(req))
}

async function handleGet(req, { params }) {
  if (!ENABLED) return privateJson({ error: 'Agenticni run ugovor još nije aktivan u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return privateJson({ error: 'Prijavi se.' }, { status: 401 })
  const runId = String((await params).runId || '').trim()
  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  if (!runId || !projectId) return privateJson({ error: 'Nedostaje run ili projekt.' }, { status: 400 })
  const run = await loadOwnedRun(supabase, user.id, runId, projectId)
  if (run.error) return privateJson({ error: 'Stanje privremenih podataka nije moguće učitati.' }, { status: 503 })
  if (!run.value) return privateJson({ error: 'Run nije pronađen.' }, { status: 404 })
  return privateJson({
    runId,
    projectId,
    status: privacyStatus(run.value),
    expiresAt: typeof run.value.payload_expires_at === 'string' ? run.value.payload_expires_at : null,
    deletedAt: typeof run.value.payload_deleted_at === 'string' ? run.value.payload_deleted_at : null,
    cleanupError: typeof run.value.payload_cleanup_error === 'string' ? run.value.payload_cleanup_error : null,
  })
}

async function handleDelete(req, { params }) {
  const origin = validateSameOriginRequest(req, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return privateJson({ error: origin.error }, { status: origin.status })
  if (!ENABLED) return privateJson({ error: 'Agenticni run ugovor još nije aktivan u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return privateJson({ error: 'Prijavi se.' }, { status: 401 })
  const runId = String((await params).runId || '').trim()
  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  if (!runId || !projectId) return privateJson({ error: 'Nedostaje run ili projekt.' }, { status: 400 })
  const run = await loadOwnedRun(supabase, user.id, runId, projectId)
  if (run.error) return privateJson({ error: 'Stanje runa nije moguće provjeriti.' }, { status: 503 })
  if (!run.value) return privateJson({ error: 'Run nije pronađen.' }, { status: 404 })
  if (!['completed', 'blocked', 'failed', 'cancelled'].includes(String(run.value.status))) {
    return privateJson({ error: 'Privremeni se podaci mogu obrisati nakon završetka ili zaustavljanja runa.' }, { status: 409 })
  }

  const result = await deleteAgentRunPayloads(supabase, { userId: user.id, projectId, runId })
  if (!result.ok) {
    logOperationalEvent({ eventName: 'agent_run_payload_delete_requested_failed', userId: user.id, projectId, runId, reason: result.status }, 'error')
    return privateJson({ status: result.status, error: result.error, deleted: result.deleted }, { status: 503 })
  }
  return privateJson({ status: result.status, deleted: result.deleted })
}

async function loadOwnedRun(supabase, userId, runId, projectId) {
  try {
    const result = await supabase.from('agent_runs')
      .select('run_id, user_id, project_id, status, payload_cleanup_status, payload_expires_at, payload_deleted_at, payload_cleanup_error')
      .eq('run_id', runId)
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle()
    return result.error ? { error: result.error } : { value: result.data || null }
  } catch (error) {
    return { error }
  }
}

function privacyStatus(run) {
  if (run.payload_cleanup_status === 'deleted' || run.payload_deleted_at) return 'deleted'
  if (run.payload_cleanup_status === 'deletion_scheduled') return 'deletion_scheduled'
  if (run.payload_cleanup_status === 'deletion_failed') return 'deletion_failed'
  return 'temporarily_uploaded'
}
