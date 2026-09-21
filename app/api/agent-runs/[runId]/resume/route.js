import { createClient } from '@/lib/supabase/server'
import { readProjectLock } from '@/lib/academic-suite/project-lock'
import { lookupActiveProjectPassForProduct } from '@/lib/academic-suite/repositories/entitlements'
import { resumeAgentRun } from '@/lib/agents/backend-contract'
import { productTierForWorkType } from '@/lib/product/lifecycle'
import { privateJson } from '@/lib/observability/private-response.js'
import { logOperationalEvent } from '@/lib/observability/operational-events'
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
  const runId = String((await params).runId || '').trim()
  if (!runId) return Response.json({ error: 'Nedostaje ID runa.' }, { status: 400 })
  const { data: run, error: runError } = await supabase
    .from('agent_runs')
    .select('run_id, project_id, status')
    .eq('run_id', runId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (runError) return Response.json({ error: 'Run nije moguće učitati.' }, { status: 503 })
  if (!run) return Response.json({ error: 'Run nije pronađen.' }, { status: 404 })
  const lock = await readProjectLock(supabase, { userId: user.id, projectId: run.project_id })
  if (!lock.ok) return Response.json({ error: 'Provjera Passa nije uspjela.' }, { status: 503 })
  if (!lock.lock) return Response.json({ error: 'Aktivan Pass za ovaj projekt je potreban.' }, { status: 402 })
  const productKey = normalizeProductKey(lock.lock.productKey)
  if (!productKey || productTierForWorkType(lock.lock.workType) !== productKey) {
    return Response.json({ error: 'Zaključani projekt ima neispravan proizvodni opseg.' }, { status: 503 })
  }
  const passLookup = await lookupActiveProjectPassForProduct(supabase, { userId: user.id, projectId: run.project_id, productId: `katedra_pass_${productKey}` })
  if (!passLookup.ok) {
    logOperationalEvent({ eventName: 'agent_run_resume_pass_lookup_unavailable', userId: user.id, projectId: run.project_id, runId, error: passLookup.error }, 'error')
    return Response.json({ error: 'Status Passa trenutno nije moguće provjeriti.' }, { status: 503 })
  }
  if (!passLookup.active) return Response.json({ error: 'Aktivan Pass za ovaj projekt je potreban.' }, { status: 402 })
  const transitioned = await resumeAgentRun(supabase, { userId: user.id, runId })
  if (!transitioned.ok) return Response.json({ error: 'Nastavak runa nije uspio.' }, { status: 503 })
  return privateJson(transitioned.value)
}

function normalizeProductKey(value) {
  if (value === 'seminarski' || value === 'zavrsni' || value === 'diplomski') return value
  if (value === 'katedra_pass_seminarski' || value === 'katedra_pass_zavrsni' || value === 'katedra_pass_diplomski') return value.replace('katedra_pass_', '')
  return null
}
