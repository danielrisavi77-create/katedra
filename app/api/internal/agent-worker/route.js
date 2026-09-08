import { timingSafeEqual } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import { createAnthropicAgentProvider } from '@/lib/agents/anthropic-provider'
import { createGatewayAgentProvider } from '@/lib/agents/provider-gateway'
import { createProviderRouter } from '@/lib/agents/provider-router'
import { createProviderBackedExecutor } from '@/lib/agents/provider-worker'
import { packProfileHint } from '@/lib/agents/pack-profile.server'
import { resolveCapability } from '@/lib/academic-suite/process-facts'
import { loadProcessFactsFromDisk } from '@/lib/academic-suite/process-facts.server'
import { runAgentWorkerLoop } from '@/lib/agents/worker-loop'
import { createSupabaseRunPayloadManifestStore, loadRunMaterialContexts } from '@/lib/agents/run-context-loader'
import { loadActiveRunManuscriptContext, loadActiveRunContextSnapshot } from '@/lib/agents/run-context-access'
import { AGENT_IDS } from '@/lib/agents/contracts'
import { resolveAgentWorkerConfiguration } from '@/lib/agents/worker-config'
import { createGateBackedVerifier, resolveGateVerifierConfig, GATE_PHASE_FOR_AGENT } from '@/lib/agents/gate-verifier'
import { buildPlanReview, isPlanApprovalCurrent, PlanApprovalRequiredError } from '@/lib/agents/plan-approval'
import { selectVerifiedAgentArtifacts } from '@/lib/agents/artifact-chain'
import { verifyAgentResult } from '@/lib/agents/verifier'
import { createIndependentCitationVerifier } from '@/lib/agents/source-verification'
import { createGatewayPassageVerifier, executeBilledPassageVerification } from '@/lib/agents/passage-verification'
import { loadAgentRunResults, storeAgentStepResult } from '@/lib/agents/run-result-storage'
import { isAgentVerifierProviderAvailable } from '@/lib/deployment/agentic-availability'
import { JSON_BODY_LIMITS, readJsonBody } from '@/lib/http/json-body.js'
import { privateJson } from '@/lib/observability/private-response.js'
import { getRequestId, withRequestId } from '@/lib/observability/request-id.js'
import { logAiEvent, safeErrorCode } from '@/lib/observability/ai-events'

export const runtime = 'nodejs'

const ENABLED = process.env.KATEDRA_AGENT_RUNS_ENABLED === 'true'
const BUCKET = process.env.KATEDRA_TEMP_MATERIALS_BUCKET || 'katedra-temporary-materials'
const WORKER_TOKEN = process.env.KATEDRA_AGENT_WORKER_TOKEN || ''

export async function POST(req) {
  const requestId = getRequestId(req)
  try {
    return withRequestId(await handlePost(req), requestId)
  } catch (error) {
    console.error(JSON.stringify({
      eventName: 'agent_worker_execution_failed',
      requestId,
      error: error instanceof Error ? error.name : 'unknown',
    }))
    return withRequestId(privateJson({ error: 'Agent worker trenutno nije mogao obraditi korak.' }, { status: 503 }), requestId)
  }
}

async function handlePost(req) {
  if (!ENABLED) return privateJson({ error: 'Agenticni worker još nije aktivan u backendu.' }, { status: 503 })
  if (process.env.KATEDRA_PROJECT_LOCKS_ENABLED !== 'true') {
    return privateJson({ error: 'Agenticni worker nije aktivan bez server-side project lock ugovora.' }, { status: 503 })
  }
  if (!isAuthorized(req.headers.get('x-katedra-agent-worker-token'), WORKER_TOKEN)) {
    return privateJson({ error: 'Neovlašteni worker.' }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY) return privateJson({ error: 'AI provider nije konfiguriran.' }, { status: 503 })
  const workerConfig = resolveAgentWorkerConfiguration(process.env)
  if (!workerConfig.ok) {
    console.error('agent worker safety configuration unavailable', {
      missing: workerConfig.missing,
      invalid: workerConfig.invalid,
    })
    return privateJson({ error: 'Agent worker još nije konfiguriran za sigurnu naplatu.' }, { status: 503 })
  }

  const parsed = await readJsonBody(req, JSON_BODY_LIMITS.worker)
  if (!parsed.ok) return privateJson({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value
  const runId = typeof body?.runId === 'string' ? body.runId.trim() : ''
  if (!runId || runId.length > 200) return privateJson({ error: 'Nedostaje run.' }, { status: 400 })

  let db
  try {
    db = createAdminClient()
  } catch (error) {
    logAiEvent({ eventName: 'agent_worker_admin_client_unavailable', requestId, userId: 'unknown', projectId: 'unknown', runId, errorCode: safeErrorCode(error), outcome: 'failed' }, 'error')
    return privateJson({ error: 'Agent worker storage trenutno nije konfiguriran.' }, { status: 503 })
  }
  const { data: run, error: runError } = await db.from('agent_runs')
    .select('run_id, user_id, project_id, mode, source_policy, status')
    .eq('run_id', runId)
    .maybeSingle()
  if (runError) return privateJson({ error: 'Run nije moguće učitati.' }, { status: 503 })
  if (!run) return privateJson({ error: 'Run nije pronađen.' }, { status: 404 })
  if (['completed', 'blocked', 'failed', 'cancelled'].includes(run.status)) return privateJson({ status: run.status, stepsProcessed: 0 })

  if (run.status === 'initializing') return privateJson({ status: run.status, stepsProcessed: 0 }, { status: 409 })
  if (run.status === 'paused') return privateJson({ status: run.status, stepsProcessed: 0 })
  if (!['pending', 'running'].includes(run.status)) return privateJson({ status: run.status, stepsProcessed: 0 }, { status: 409 })

  const provider = createAnthropicAgentProvider({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: workerConfig.model,
    timeoutMs: 150_000,
    enableVision: process.env.KATEDRA_ANTHROPIC_VISION_ENABLED === 'true',
  })
  const providers = [provider]
  const assignments = Object.fromEntries(AGENT_IDS.map((agent) => [agent, provider.id]))
  if (run.source_policy === 'web_research' && isResearchGatewayConfigured(process.env)) {
    const researchProvider = createGatewayAgentProvider({
      id: 'configured-research-gateway',
      endpoint: process.env.KATEDRA_RESEARCH_PROVIDER_URL,
      apiKey: process.env.KATEDRA_RESEARCH_PROVIDER_KEY,
      model: process.env.KATEDRA_RESEARCH_PROVIDER_MODEL,
      capabilities: ['text', 'web_research'],
      timeoutMs: 150_000,
    })
    providers.push(researchProvider)
    assignments.sources = researchProvider.id
  }
  if (isAgentVerifierProviderAvailable(process.env)) {
    const verifierProvider = createGatewayAgentProvider({
      id: 'configured-verifier-gateway',
      endpoint: process.env.KATEDRA_VERIFIER_PROVIDER_URL,
      apiKey: process.env.KATEDRA_VERIFIER_PROVIDER_KEY,
      model: process.env.KATEDRA_VERIFIER_PROVIDER_MODEL,
      capabilities: ['text'],
      timeoutMs: 150_000,
    })
    providers.push(verifierProvider)
    assignments.citation = verifierProvider.id
    assignments.review = verifierProvider.id
  }
  const router = createProviderRouter({
    providers,
    assignments,
  })
  const citationVerifier = createIndependentCitationVerifier()
  const passageVerifier = isAgentVerifierProviderAvailable(process.env)
    ? createGatewayPassageVerifier({
      endpoint: process.env.KATEDRA_VERIFIER_PROVIDER_URL,
      apiKey: process.env.KATEDRA_VERIFIER_PROVIDER_KEY,
      model: process.env.KATEDRA_VERIFIER_PROVIDER_MODEL,
      timeoutMs: 30_000,
    })
    : undefined
  const storage = db.storage.from(BUCKET)
  const payloadStorage = {
    async download(path) {
      const downloaded = await storage.download(path)
      if (downloaded.error || !downloaded.data) throw new Error('Privatni agent payload nije moguće učitati.')
      return downloaded.data.arrayBuffer()
    },
  }
  const manifestStore = createSupabaseRunPayloadManifestStore(db)
  const executorOptions = {
    projectId: run.project_id,
    runId,
    sourcePolicy: run.source_policy,
    loadProfileHint: (manuscript) => packProfileHint(manuscript.meta?.profileId),
    loadPolicyBlocked: async (manuscript) => {
      const facts = await loadProcessFactsFromDisk()
      const resolved = resolveCapability(facts, manuscript.meta?.unitId || '', 'generate_large_sections')
      // Mentorov unlock ovdje namjerno ne vrijedi: agent run nema ack tok.
      return resolved.effective === 'blocked'
    },
    runMode: run.mode,
    loadContext: () => loadActiveRunManuscriptContext(manifestStore, payloadStorage, { runId, projectId: run.project_id, userId: run.user_id, bucket: BUCKET }),
    loadMaterials: () => loadRunMaterialContexts(manifestStore, payloadStorage, { runId, projectId: run.project_id, userId: run.user_id, bucket: BUCKET }),
    loadResults: () => loadAgentRunResults(manifestStore, payloadStorage, { runId, projectId: run.project_id, userId: run.user_id, bucket: BUCKET }),
    verifyCitations: citationVerifier.verify,
    verifyPassages: passageVerifier
      ? ({ projectId, runId: currentRunId, claims, citations, requestId: passageRequestId, agent, attempt }) => executeBilledPassageVerification(db, {
        verifier: passageVerifier,
        provider: 'configured-verifier-gateway',
        model: process.env.KATEDRA_VERIFIER_PROVIDER_MODEL,
        userId: run.user_id,
        projectId,
        runId: currentRunId,
        requestId: passageRequestId,
        agent,
        attempt,
        claims,
        citations,
      })
      : undefined,
    router,
    billing: { db, userId: run.user_id, model: workerConfig.model },
  }
  const execute = createProviderBackedExecutor(executorOptions)
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
  const gateConfig = resolveGateVerifierConfig(process.env)
  const loadGateContext = async ({ step }) => {
    const { manuscript, planApproval } = await loadActiveRunContextSnapshot(manifestStore, payloadStorage, {
      runId, projectId: run.project_id, userId: run.user_id, bucket: BUCKET,
    })
    const results = await loadAgentRunResults(manifestStore, payloadStorage, { runId, projectId: run.project_id, userId: run.user_id, bucket: BUCKET })
    const artifacts = selectVerifiedAgentArtifacts(results, { order: step.order, projectId: run.project_id, runId })
    return { manuscript, artifacts, planApproval, results }
  }
  const gateVerify = createGateBackedVerifier({
    config: gateConfig, runId, userId: run.user_id,
    baseVerify: (agentResult) => verifyAgentResult(agentResult, { requireIndependentSourceVerification: true, requireIndependentPassageVerification: true }),
    loadContext: loadGateContext,
    loadProfileHint: (manuscript) => packProfileHint(manuscript.meta?.profileId),
    onGateResult: (summary) => logAiEvent({
      eventName: 'agent_gate_verified', requestId: getRequestId(req), runId,
      userId: run.user_id, projectId: run.project_id, gate: summary,
    }),
  })
  const executeWithApproval = async (step) => {
    if (GATE_PHASE_FOR_AGENT[step.agent] !== 'plan') {
      const { manuscript, artifacts, planApproval, results } = await loadGateContext({ step })
      const review = buildPlanReview(manuscript, artifacts)
      if (!review.ready || !isPlanApprovalCurrent(planApproval, {
        userId: run.user_id, projectId: run.project_id, runId, planRevision: review.planRevision,
      })) throw new PlanApprovalRequiredError()
      // Use the approved snapshot throughout execution: a concurrent context upload
      // must not replace the plan between this check and the billed provider call.
      return createProviderBackedExecutor({
        ...executorOptions,
        loadContext: async () => manuscript,
        loadResults: async () => results,
      })(step)
    }
    return execute(step)
  }
  const result = await runAgentWorkerLoop(
    { db, workerId: process.env.KATEDRA_AGENT_WORKER_ID || 'katedra-web-worker', runId },
    { execute: executeWithApproval, verify: gateVerify, storeResult },
    { maxSteps: 1 },
  )
  if (result.error) return privateJson({ error: 'Agent worker trenutno nije mogao obraditi korak.' }, { status: 503 })
  return privateJson({ runId, ...result })
}

function isAuthorized(actual, expected) {
  if (!actual || !expected) return false
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

function isResearchGatewayConfigured(env) {
  if (env.KATEDRA_RESEARCH_POLICY_APPROVED !== 'true') return false
  if (!isHttpsUrl(env.KATEDRA_RESEARCH_PROVIDER_URL)) return false
  return isConfigured(env.KATEDRA_RESEARCH_PROVIDER_KEY) && isConfigured(env.KATEDRA_RESEARCH_PROVIDER_MODEL)
}

function isConfigured(value) {
  return typeof value === 'string' && Boolean(value.trim()) && !value.trim().startsWith('REPLACE_')
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value)).protocol === 'https:'
  } catch {
    return false
  }
}
