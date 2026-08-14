import { createClient } from '@/lib/supabase/server'
import { cancelAgentRun } from '@/lib/agents/backend-contract'

const ENABLED = process.env.KATEDRA_AGENT_RUNS_ENABLED === 'true'

export async function GET(req, { params }) {
  if (!ENABLED) return Response.json({ error: 'Agenticni run ugovor još nije aktivan u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const runId = (await params).runId
  const { data: run, error } = await supabase.from('agent_runs')
    .select('run_id, project_id, mode, source_policy, status, created_at, updated_at')
    .eq('run_id', runId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return Response.json({ error: 'Učitavanje runa nije uspjelo.' }, { status: 503 })
  if (!run) return Response.json({ error: 'Run nije pronađen.' }, { status: 404 })
  const { data: steps, error: stepsError } = await supabase.from('agent_steps')
    .select('step_id, agent, verifier, section_id, step_order, attempt, status, last_verification')
    .eq('run_id', runId)
    .order('step_order', { ascending: true })
  if (stepsError) return Response.json({ error: 'Učitavanje koraka nije uspjelo.' }, { status: 503 })
  return Response.json({ run, steps: steps || [] })
}

export async function DELETE(req, { params }) {
  if (!ENABLED) return Response.json({ error: 'Agenticni run ugovor još nije aktivan u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const runId = (await params).runId
  const cancelled = await cancelAgentRun(supabase, { userId: user.id, runId })
  if (!cancelled.ok) return Response.json({ error: 'Otkazivanje runa nije uspjelo.' }, { status: 503 })
  return Response.json(cancelled.value)
}
