import { createClient } from '@/lib/supabase/server'
import { readProjectLock } from '@/lib/academic-suite/project-lock'
import { lookupActiveProjectPassForProduct } from '@/lib/academic-suite/repositories/entitlements'
import { MAX_AGENT_CONTEXT_BYTES } from '@/lib/agents/run-context'
import { storeAgentRunContext } from '@/lib/agents/run-context-storage'
import { attachAgentPayloadsToRun } from '@/lib/agents/backend-contract'
import { productTierForWorkType } from '@/lib/product/lifecycle'

const ENABLED = process.env.KATEDRA_AGENT_RUNS_ENABLED === 'true'
const BUCKET = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'

export async function POST(req, { params }) {
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
  if (['completed', 'failed', 'cancelled'].includes(run.status)) {
    return Response.json({ error: 'Kontekst se ne može promijeniti nakon završetka runa.' }, { status: 409 })
  }

  const lock = await readProjectLock(supabase, { userId: user.id, projectId: run.project_id })
  if (!lock.ok) return Response.json({ error: 'Provjera Passa nije uspjela.' }, { status: 503 })
  if (!lock.lock) return Response.json({ error: 'Aktivan Pass za ovaj projekt je potreban.' }, { status: 402 })
  const productKey = normalizeProductKey(lock.lock.productKey)
  if (!productKey || productTierForWorkType(lock.lock.workType) !== productKey) {
    return Response.json({ error: 'Zaključani projekt ima neispravan proizvodni opseg.' }, { status: 503 })
  }
  const passLookup = await lookupActiveProjectPassForProduct(supabase, { userId: user.id, projectId: run.project_id, productId: `katedra_pass_${productKey}` })
  if (!passLookup.ok) {
    console.error(JSON.stringify({ eventName: 'agent_run_context_pass_lookup_unavailable', userId: user.id, projectId: run.project_id, runId, error: passLookup.error }))
    return Response.json({ error: 'Status Passa trenutno nije moguće provjeriti.' }, { status: 503 })
  }
  if (!passLookup.active) return Response.json({ error: 'Aktivan Pass za ovaj projekt je potreban.' }, { status: 402 })

  let rawBody
  try {
    rawBody = Buffer.from(await req.arrayBuffer())
  } catch {
    return Response.json({ error: 'Neispravan zahtjev.' }, { status: 400 })
  }
  if (rawBody.byteLength > MAX_AGENT_CONTEXT_BYTES) {
    return Response.json({ error: 'Kontekst rukopisa je prevelik.' }, { status: 413 })
  }

  let body
  try { body = JSON.parse(rawBody.toString('utf8')) } catch {
    return Response.json({ error: 'Neispravan JSON kontekst.' }, { status: 400 })
  }
  const materialIds = body?.materialIds === undefined ? [] : body.materialIds
  if (!Array.isArray(materialIds) || materialIds.length > 100 || materialIds.some((id) => typeof id !== 'string' || !id.trim() || id.length > 200)) {
    return Response.json({ error: 'Popis materijala nije valjan.' }, { status: 400 })
  }
  const stored = await storeAgentRunContext(supabase, {
    userId: user.id,
    projectId: run.project_id,
    runId,
    manuscript: body?.manuscript,
    bucket: BUCKET,
  })
  if (!stored.ok) return Response.json({ error: stored.error }, { status: stored.status })

  if (materialIds.length > 0) {
    const attached = await attachAgentPayloadsToRun(supabase, {
      userId: user.id,
      projectId: run.project_id,
      runId,
      materialIds: [...new Set(materialIds)],
    })
    if (!attached.ok) return Response.json({ error: 'Odabrani materijali nisu mogli biti vezani uz run.' }, { status: 503 })
    const requested = [...new Set(materialIds)].sort()
    const received = [...attached.value.materialIds].sort()
    if (requested.length !== received.length || requested.some((id, index) => id !== received[index])) {
      return Response.json({ error: 'Svi odabrani materijali nisu potvrđeni za ovaj run.' }, { status: 409 })
    }
  }

  return Response.json({ runId, manifestId: stored.value.manifestId, expiresAt: stored.value.expiresAt, attachedMaterialIds: [...new Set(materialIds)] })
}

function normalizeProductKey(value) {
  if (value === 'seminarski' || value === 'zavrsni' || value === 'diplomski') return value
  if (value === 'katedra_pass_seminarski' || value === 'katedra_pass_zavrsni' || value === 'katedra_pass_diplomski') return value.replace('katedra_pass_', '')
  return null
}
