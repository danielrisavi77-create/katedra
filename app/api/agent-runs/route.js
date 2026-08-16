import { createClient } from '@/lib/supabase/server'
import { resolveOwnedProjectResult } from '@/lib/academic-suite/repositories/projects'
import { readProjectLock, validateLockedProjectMutation } from '@/lib/academic-suite/project-lock'
import { activateAgentRun, cancelAgentRun, cleanupStaleInitializingAgentRun, createAgentRun, replaceAgentPayloadsForRun } from '@/lib/agents/backend-contract'
import { parseAgentRunRequest, validateAgentRunSectionSelection } from '@/lib/agents/run-request'
import { validateAgentRunContext } from '@/lib/agents/run-context'
import { storeAgentRunContext } from '@/lib/agents/run-context-storage'
import { resolveCanonicalProjectPass, resolveProjectCapability } from '@/lib/product/server-capabilities'
import { privateJson } from '@/lib/observability/private-response.js'
import { JSON_BODY_LIMITS, readJsonBody } from '@/lib/http/json-body.js'
import { getRequestId, withRequestId } from '@/lib/observability/request-id.js'
import { isAgentWebResearchAvailable, isAgenticWorkspaceAvailable } from '@/lib/deployment/agentic-availability'

const ENABLED = process.env.KATEDRA_AGENT_RUNS_ENABLED === 'true'
const BUCKET = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'

export async function POST(req) {
  return withRequestId(await handlePost(req), getRequestId(req))
}

async function handlePost(req) {
  if (!ENABLED) return Response.json({ error: 'Agenticni run ugovor još nije aktivan u backendu.' }, { status: 503 })
  if (!isAgenticWorkspaceAvailable()) return Response.json({ error: 'Agenticni workflow još nije konfiguriran za siguran rad.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  if (!projectId) return Response.json({ error: 'Nedostaje projekt.' }, { status: 400 })
  const projectResult = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId })
  if ('error' in projectResult) {
    console.error(JSON.stringify({ eventName: 'agent_run_project_lookup_failed', userId: user.id, projectId, error: projectResult.error }))
    return Response.json({ error: 'Projekt trenutačno nije moguće provjeriti.' }, { status: 503 })
  }
  const project = projectResult.value
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })

  const body = await readJsonBody(req, JSON_BODY_LIMITS.agentRun)
  if (!body.ok) return Response.json({ error: body.error }, { status: body.status })
  const parsed = parseAgentRunRequest(body.value)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  if (parsed.value.sourcePolicy === 'web_research' && !isAgentWebResearchAvailable()) {
    return Response.json({ error: 'Web istraživački workflow još nije dostupan.' }, { status: 503 })
  }
  if (parsed.value.manuscript === undefined) return Response.json({ error: 'Snapshot rukopisa je obavezan za agenticni run.' }, { status: 400 })

  const validatedContext = validateAgentRunContext({ manuscript: parsed.value.manuscript }, project.projectId)
  if (!validatedContext.ok) {
    const status = validatedContext.reason === 'project_mismatch' ? 403 : validatedContext.reason === 'too_large' ? 413 : 400
    return Response.json({ error: validatedContext.error }, { status })
  }
  const lock = await readProjectLock(supabase, { userId: user.id, projectId: project.projectId })
  if (!lock.ok) return Response.json({ error: 'Provjera zaključavanja projekta nije uspjela.' }, { status: 503 })
  if (!lock.lock) return Response.json({ error: 'Aktivan Pass za ovaj projekt je potreban.' }, { status: 402 })
  const lockValidation = validateLockedProjectMutation(lock.lock, {
    topic: validatedContext.manuscript.title,
    workType: validatedContext.manuscript.workType,
  })
  if (!lockValidation.ok) return Response.json({ error: lockValidation.error }, { status: lockValidation.status })
  const canonicalPass = await resolveCanonicalProjectPass(supabase, {
    userId: user.id,
    projectId: project.projectId,
  })
  if (!canonicalPass.allowed) {
    return Response.json({ error: canonicalPass.code === 'pass_required' ? 'Aktivan Pass za ovaj projekt je potreban.' : 'Canonical status Pasa trenutno nije moguće provjeriti.' }, {
      status: canonicalPass.code === 'pass_required' ? 402 : 503,
    })
  }
  const sectionSelection = validateAgentRunSectionSelection(parsed.value.sectionIds, validatedContext.manuscript)
  if (!sectionSelection.ok) return Response.json({ error: sectionSelection.error }, { status: 400 })

  const capability = parsed.value.mode === 'autonomous'
    ? 'autonomous_run'
    : parsed.value.sourcePolicy === 'web_research'
      ? 'web_research'
      : parsed.value.sourcePolicy === 'uploaded_plus_suggestions'
        ? 'source_suggestions'
        : 'section_writing'
  const decision = await resolveProjectCapability(supabase, {
    userId: user.id,
    projectId: project.projectId,
    capability,
  })
  if (!decision.allowed) {
    const status = decision.code === 'pass_required' ? 402
      : decision.code === 'project_not_owned' ? 404
        : decision.code === 'unauthenticated' ? 401
          : decision.code === 'capability_unavailable' ? 503 : 403
    return Response.json({ error: decision.code === 'policy_unverified'
      ? 'Institucijska pravila za web istraživanje još nisu verificirana.'
      : 'Ova agenticna mogućnost nije dostupna za ovaj projekt.' }, { status })
  }

  const recovered = await cleanupStaleInitializingAgentRun(supabase, {
    userId: user.id,
    projectId: project.projectId,
  })
  if (!recovered.ok) {
    console.error('canonical cleanup_stale_initializing_agent_run failed', { userId: user.id, projectId: project.projectId, error: recovered.error })
    return Response.json({ error: 'Prethodni agent run trenutno nije moguće sigurno zatvoriti.' }, { status: 503 })
  }

  const created = await createAgentRun(supabase, {
    userId: user.id,
    projectId: project.projectId,
    mode: parsed.value.mode,
    sourcePolicy: parsed.value.sourcePolicy,
    sectionIds: sectionSelection.value,
  })
  if (!created.ok) {
    console.error('canonical create_agent_run failed', { userId: user.id, projectId: project.projectId, error: created.error })
    return Response.json({ error: 'Pokretanje agenta trenutno nije dostupno.' }, { status: 503 })
  }

  const context = await storeAgentRunContext(supabase, {
    userId: user.id,
    projectId: project.projectId,
    runId: created.runId,
    manuscript: validatedContext.manuscript,
    bucket: BUCKET,
  })
  if (!context.ok) {
    await cancelFailedSetupRun(supabase, { userId: user.id, runId: created.runId }, context.error)
    return Response.json({ error: context.error }, { status: context.status })
  }

  // Keep the run in `initializing` until every selected payload is attached.
  // Otherwise a worker could claim the first step before its inputs exist.
  if (parsed.value.materialIds?.length) {
    const attached = await replaceAgentPayloadsForRun(supabase, {
      userId: user.id,
      projectId: project.projectId,
      runId: created.runId,
      materialIds: parsed.value.materialIds,
    })
    if (!attached.ok || attached.value.materialIds.length !== parsed.value.materialIds.length) {
      await cancelFailedSetupRun(supabase, { userId: user.id, runId: created.runId }, attached.ok ? 'material_selection_mismatch' : attached.error)
      return Response.json({ error: attached.ok ? 'Jedan ili više materijala više nije dostupan.' : 'Povezivanje materijala nije uspjelo.' }, { status: attached.ok ? 409 : 503 })
    }
  }

  const activated = await activateAgentRun(supabase, { userId: user.id, runId: created.runId })
  if (!activated.ok) {
    await cancelFailedSetupRun(supabase, { userId: user.id, runId: created.runId }, activated.error)
    return Response.json({ error: 'Agent run nije moguće aktivirati.' }, { status: 503 })
  }

  const { data: run, error: runError } = await supabase.from('agent_runs')
    .select('run_id, project_id, mode, source_policy, status, created_at, updated_at')
    .eq('run_id', created.runId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (runError || !run) return Response.json({ error: 'Stanje pokrenutog agenta nije moguće učitati.' }, { status: 503 })
  const { data: steps, error: stepsError } = await supabase.from('agent_steps')
    .select('step_id, agent, verifier, section_id, step_order, attempt, status, provider, usage, last_verification')
    .eq('run_id', created.runId)
    .order('step_order', { ascending: true })
  if (stepsError) return Response.json({ error: 'Koraci pokrenutog agenta nisu moguće učitati.' }, { status: 503 })

  return privateJson({ runId: created.runId, projectId: project.projectId, run, steps: steps || [] })
}

export async function GET(req) {
  return withRequestId(await handleGet(req), getRequestId(req))
}

async function handleGet(req) {
  if (!ENABLED) return Response.json({ error: 'Agenticni run ugovor još nije aktivan u backendu.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  if (!projectId) return Response.json({ error: 'Nedostaje projekt.' }, { status: 400 })
  const projectResult = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId })
  if ('error' in projectResult) {
    console.error(JSON.stringify({ eventName: 'agent_run_list_project_lookup_failed', userId: user.id, projectId, error: projectResult.error }))
    return Response.json({ error: 'Projekt trenutačno nije moguće provjeriti.' }, { status: 503 })
  }
  const project = projectResult.value
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const { data, error } = await supabase
    .from('agent_runs')
    .select('run_id, project_id, mode, source_policy, status, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('project_id', project.projectId)
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: 'Učitavanje agent runova nije uspjelo.' }, { status: 503 })
  return privateJson({ runs: data || [] })
}

async function cancelFailedSetupRun(db, input, reason) {
  const cancelled = await cancelAgentRun(db, input)
  if (!cancelled.ok) {
    console.error('canonical cancel_agent_run failed after setup error', {
      userId: input.userId,
      runId: input.runId,
      reason,
      error: cancelled.error,
    })
  }
}
