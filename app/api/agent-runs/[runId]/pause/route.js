import { createClient } from '@/lib/supabase/server'
import { pauseAgentRun } from '@/lib/agents/backend-contract'
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
  const transitioned = await pauseAgentRun(supabase, { userId: user.id, runId })
  if (!transitioned.ok) return Response.json({ error: 'Pauziranje runa nije uspjelo.' }, { status: 503 })
  return privateJson(transitioned.value)
}
