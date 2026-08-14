import { timingSafeEqual } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/server'
import { createAnthropicAgentProvider } from '@/lib/agents/anthropic-provider'
import { createProviderRouter } from '@/lib/agents/provider-router'
import { createProviderBackedExecutor } from '@/lib/agents/provider-worker'
import { runAgentWorkerLoop } from '@/lib/agents/worker-loop'
import { createSupabaseRunPayloadManifestStore, loadRunManuscriptContext, loadRunMaterialContexts } from '@/lib/agents/run-context-loader'
import { runContextStoragePaths } from '@/lib/agents/run-context'
import { AGENT_IDS } from '@/lib/agents/contracts'
import { resolveAgentWorkerConfiguration } from '@/lib/agents/worker-config'
import { verifyAgentResult } from '@/lib/agents/verifier'
import { storeAgentStepResult } from '@/lib/agents/run-result-storage'

export const runtime = 'nodejs'

const ENABLED = process.env.KATEDRA_AGENT_RUNS_ENABLED === 'true'
const BUCKET = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'
const WORKER_TOKEN = process.env.KATEDRA_AGENT_WORKER_TOKEN || ''

export async function POST(req) {
  if (!ENABLED) return Response.json({ error: 'Agenticni worker još nije aktivan u backendu.' }, { status: 503 })
  if (!isAuthorized(req.headers.get('x-katedra-agent-worker-token'), WORKER_TOKEN)) {
    return Response.json({ error: 'Neovlašteni worker.' }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'AI provider nije konfiguriran.' }, { status: 503 })
  const workerConfig = resolveAgentWorkerConfiguration(process.env)
  if (!workerConfig.ok) {
    console.error('agent worker safety configuration unavailable', {
      missing: workerConfig.missing,
      invalid: workerConfig.invalid,
    })
    return Response.json({ error: 'Agent worker joĹˇ nije konfiguriran za sigurnu naplatu.' }, { status: 503 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'Neispravan zahtjev.' }, { status: 400 }) }
  const runId = typeof body?.runId === 'string' ? body.runId.trim() : ''
  if (!runId || runId.length > 200) return Response.json({ error: 'Nedostaje run.' }, { status: 400 })

  const db = createAdminClient()
  const { data: run, error: runError } = await db.from('agent_runs')
    .select('run_id, user_id, project_id, source_policy, status')
    .eq('run_id', runId)
    .maybeSingle()
  if (runError) return Response.json({ error: 'Run nije moguće učitati.' }, { status: 503 })
  if (!run) return Response.json({ error: 'Run nije pronađen.' }, { status: 404 })
  if (['completed', 'blocked', 'failed', 'cancelled'].includes(run.status)) return Response.json({ status: run.status, stepsProcessed: 0 })

  const provider = createAnthropicAgentProvider({ apiKey: process.env.ANTHROPIC_API_KEY, model: workerConfig.model })
  const router = createProviderRouter({
    providers: [provider],
    assignments: Object.fromEntries(AGENT_IDS.map((agent) => [agent, provider.id])),
  })
  const storage = db.storage.from(BUCKET)
  const payloadStorage = {
    async download(path) {
      const downloaded = await storage.download(path)
      if (downloaded.error) throw new Error('Privatni agent payload nije moguće učitati.')
      return downloaded.data.arrayBuffer()
    },
  }
  const manifestStore = createSupabaseRunPayloadManifestStore(db)
  const paths = runContextStoragePaths(run.user_id, run.project_id, runId)
  const execute = createProviderBackedExecutor({
    projectId: run.project_id,
    runId,
    sourcePolicy: run.source_policy,
    loadContext: () => loadRunManuscriptContext(payloadStorage, { storagePath: paths.storagePath, projectId: run.project_id }),
    loadMaterials: () => loadRunMaterialContexts(manifestStore, payloadStorage, { runId, projectId: run.project_id }),
    router,
    billing: { db, userId: run.user_id, model: workerConfig.model },
  })
  const storeResult = ({ step, result, verification }) => storeAgentStepResult({ db, storage }, {
    userId: run.user_id,
    projectId: run.project_id,
    runId,
    step,
    result,
    verification,
    bucket: BUCKET,
  }).then((stored) => {
    if (!stored.ok) throw new Error(stored.error)
    return { manifestId: stored.value.manifestId }
  })
  const result = await runAgentWorkerLoop(
    { db, workerId: process.env.KATEDRA_AGENT_WORKER_ID || 'katedra-web-worker', runId },
    { execute, verify: verifyAgentResult, storeResult },
    { maxSteps: 1 },
  )
  return Response.json({ runId, ...result })
}

function isAuthorized(actual, expected) {
  if (!actual || !expected) return false
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}
