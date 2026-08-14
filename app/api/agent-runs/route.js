import { createClient } from '@/lib/supabase/server'
import { resolveOwnedProject } from '@/lib/academic-suite/repositories/projects'
import { readProjectLock } from '@/lib/academic-suite/project-lock'
import { attachAgentPayloadsToRun, cancelAgentRun, createAgentRun } from '@/lib/agents/backend-contract'
import { parseAgentRunRequest } from '@/lib/agents/run-request'
import { storeAgentRunContext } from '@/lib/agents/run-context-storage'

const ENABLED = process.env.KATEDRA_AGENT_RUNS_ENABLED === 'true'

export async function POST(req) {
  if (!ENABLED) return Response.json({ error: 'Agenticni run ugovor još nije aktivan u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  if (!projectId) return Response.json({ error: 'Nedostaje projekt.' }, { status: 400 })
  const project = await resolveOwnedProject(supabase, { userId: user.id, projectId })
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })

  const lock = await readProjectLock(supabase, { userId: user.id, projectId: project.projectId })
  if (!lock.ok) return Response.json({ error: 'Provjera Passa nije uspjela.' }, { status: 503 })
  if (!lock.lock) return Response.json({ error: 'Aktivan Pass za ovaj projekt je potreban.' }, { status: 402 })

  let parsed
  try { parsed = parseAgentRunRequest(await req.json()) } catch { parsed = { ok: false, status: 400, error: 'Neispravan zahtjev.' } }
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  if (parsed.value.manuscript === undefined) return Response.json({ error: 'Snapshot rukopisa je obavezan za agenticni run.' }, { status: 400 })

  const created = await createAgentRun(supabase, {
    userId: user.id,
    projectId: project.projectId,
    mode: parsed.value.mode,
    sourcePolicy: parsed.value.sourcePolicy,
    sectionIds: parsed.value.sectionIds,
  })
  if (!created.ok) {
    console.error('canonical create_agent_run failed', { userId: user.id, projectId: project.projectId, error: created.error })
    return Response.json({ error: 'Pokretanje agenta trenutno nije dostupno.' }, { status: 503 })
  }

  const context = await storeAgentRunContext(supabase, {
    userId: user.id,
    projectId: project.projectId,
    runId: created.runId,
    manuscript: parsed.value.manuscript,
  })
  if (!context.ok) {
    await cancelAgentRun(supabase, { userId: user.id, runId: created.runId }).catch(() => undefined)
    return Response.json({ error: context.error }, { status: context.status })
  }
  if (parsed.value.materialIds?.length) {
    const attached = await attachAgentPayloadsToRun(supabase, {
      userId: user.id,
      projectId: project.projectId,
      runId: created.runId,
      materialIds: parsed.value.materialIds,
    })
    if (!attached.ok || attached.value.materialIds.length !== parsed.value.materialIds.length) {
      await cancelAgentRun(supabase, { userId: user.id, runId: created.runId }).catch(() => undefined)
      return Response.json({ error: attached.ok ? 'Jedan ili više materijala više nije dostupan.' : 'Povezivanje materijala nije uspjelo.' }, { status: attached.ok ? 409 : 503 })
    }
  }

  const { data: run, error: runError } = await supabase.from('agent_runs')
    .select('run_id, project_id, mode, source_policy, status, created_at, updated_at')
    .eq('run_id', created.runId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (runError || !run) return Response.json({ error: 'Stanje pokrenutog agenta nije moguće učitati.' }, { status: 503 })
  const { data: steps, error: stepsError } = await supabase.from('agent_steps')
    .select('step_id, agent, verifier, section_id, step_order, attempt, status, last_verification')
    .eq('run_id', created.runId)
    .order('step_order', { ascending: true })
  if (stepsError) return Response.json({ error: 'Koraci pokrenutog agenta nisu moguće učitati.' }, { status: 503 })

  return Response.json({ runId: created.runId, projectId: project.projectId, run, steps: steps || [] })
}

export async function GET(req) {
  if (!ENABLED) return Response.json({ error: 'Agenticni run ugovor još nije aktivan u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  if (!projectId) return Response.json({ error: 'Nedostaje projekt.' }, { status: 400 })
  const project = await resolveOwnedProject(supabase, { userId: user.id, projectId })
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const { data, error } = await supabase
    .from('agent_runs')
    .select('run_id, project_id, mode, source_policy, status, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('project_id', project.projectId)
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: 'Učitavanje agent runova nije uspjelo.' }, { status: 503 })
  return Response.json({ runs: data || [] })
}
