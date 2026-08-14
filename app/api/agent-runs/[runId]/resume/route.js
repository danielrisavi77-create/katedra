import { createClient } from '@/lib/supabase/server'
import { resumeAgentRun } from '@/lib/agents/backend-contract'

const ENABLED = process.env.KATEDRA_AGENT_RUNS_ENABLED === 'true'

export async function POST(req, { params }) {
  if (!ENABLED) return Response.json({ error: 'Agenticni run ugovor još nije aktivan u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const runId = (await params).runId
  const transitioned = await resumeAgentRun(supabase, { userId: user.id, runId })
  if (!transitioned.ok) return Response.json({ error: 'Nastavak runa nije uspio.' }, { status: 503 })
  return Response.json(transitioned.value)
}
