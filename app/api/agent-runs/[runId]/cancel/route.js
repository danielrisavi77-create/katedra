import { createClient } from '@/lib/supabase/server'
import { cancelAgentRun } from '@/lib/agents/backend-contract'
import { deleteAgentRunPayloads } from '@/lib/agents/run-payload-deletion'
import { privateJson } from '@/lib/observability/private-response.js'
import { getRequestId, withRequestId } from '@/lib/observability/request-id.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'

const ENABLED = process.env.KATEDRA_AGENT_RUNS_ENABLED === 'true'

export async function POST(req, { params }) {
  return withRequestId(await handlePost(req, { params }), getRequestId(req))
}

async function handlePost(req, { params }) {
  const origin = validateSameOriginRequest(req, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return Response.json({ error: origin.error }, { status: origin.status })
  if (!ENABLED) return Response.json({ error: 'Agenticni run ugovor još nije aktivan u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const runId = (await params).runId
  const existing = await supabase.from('agent_runs').select('project_id').eq('run_id', runId).eq('user_id', user.id).maybeSingle()
  if (existing.error) return privateJson({ error: 'Run nije moguće provjeriti.' }, { status: 503 })
  if (!existing.data?.project_id) return privateJson({ error: 'Run nije pronađen.' }, { status: 404 })
  const cancelled = await cancelAgentRun(supabase, { userId: user.id, runId })
  if (!cancelled.ok) return Response.json({ error: 'Otkazivanje runa nije uspjelo.' }, { status: 503 })
  const cleanup = await deleteAgentRunPayloads(supabase, { userId: user.id, projectId: existing.data.project_id, runId })
  return privateJson({ ...cancelled.value, privacy: cleanup.ok
    ? { status: cleanup.status, deleted: cleanup.deleted }
    : { status: cleanup.status, error: cleanup.error } })
}
