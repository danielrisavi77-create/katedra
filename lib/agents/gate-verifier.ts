/**
 * Klijent za katedra-pkg service/ (deterministički gate po fazi) i spajanje s postojećim
 * verifyAgentResult. Oba moraju proći: Katedrina provjera citata (evidence) i gate paketa.
 *
 * Fail-closed: ako servis nije konfiguriran, korak dobiva needs_revision s kodom gate_unavailable
 * samo kad je KATEDRA_GATE_VERIFIER_REQUIRED=true; inače se gate preskače i to se zapiše u issues
 * kao informacija (gate_skipped), da se postojeći runovi ne sruše prije deploya servisa.
 */

import type { AgentId, AgentResultV1, VerificationIssue, VerificationResultV1 } from './contracts'
import type { AgentStepRecord } from './run-state'
import type { ManuscriptV1 } from '../manuscript/types'
import type { VerifiedAgentArtifactContext } from './artifact-chain'
import type { DoctrineProfileHint } from './doctrine'
import { extractPlanArtifact, planLooksApprovable, type PlanArtifactV1 } from './plan-artifact'

export type GatePhase = 'plan' | 'pisanje' | 'audit' | 'predaja'

export const GATE_PHASE_FOR_AGENT: Record<AgentId, GatePhase> = {
  intake: 'plan', sources: 'plan', structure: 'plan', planning: 'plan',
  writing: 'pisanje', citation: 'pisanje', review: 'audit', export: 'predaja',
}

export interface GateIssue { code: string; step?: string; message: string; blocking: boolean }
export interface GateStep { korak: string; naziv: string; stanje: string; blokira: boolean }
export interface GateVerifierResponse {
  status: 'verified' | 'needs_revision' | 'blocked' | 'failed'
  issues: GateIssue[]
  gate?: { faza: GatePhase; prolaz: boolean; koraci: GateStep[]; sazetak?: Record<string, unknown> }
  gateExitCode?: number
}

export interface GateVerifierConfig {
  url?: string
  token?: string
  required?: boolean
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export interface GateVerifyInput {
  step: AgentStepRecord
  runId: string
  result: AgentResultV1
  manuscript: ManuscriptV1
  artifacts: readonly VerifiedAgentArtifactContext[]
  profile?: DoctrineProfileHint | null
  mentorComments?: Array<Record<string, unknown>>
}

export function resolveGateVerifierConfig(env: Record<string, string | undefined>): GateVerifierConfig {
  return {
    url: env.KATEDRA_GATE_VERIFIER_URL,
    token: env.KATEDRA_GATE_VERIFIER_TOKEN,
    required: env.KATEDRA_GATE_VERIFIER_REQUIRED === 'true',
    timeoutMs: Number(env.KATEDRA_GATE_VERIFIER_TIMEOUT_MS || 120_000),
  }
}

export function isGateVerifierConfigured(config: GateVerifierConfig): boolean {
  return Boolean(config.url && /^https?:\/\//.test(config.url) && config.token)
}

/** Sažetak koji smije u agent_steps.last_verification (zajednička tablica): bez teksta rada. */
export function gateSummaryForStorage(response: GateVerifierResponse): Record<string, unknown> {
  return {
    faza: response.gate?.faza,
    prolaz: response.gate?.prolaz ?? response.status === 'verified',
    koraci: (response.gate?.koraci || []).map((k) => ({ korak: k.korak, stanje: k.stanje, blokira: k.blokira })),
    exitCode: response.gateExitCode,
  }
}

export async function callGateVerifier(config: GateVerifierConfig, input: GateVerifyInput): Promise<GateVerifierResponse> {
  const fetchImpl = config.fetchImpl || fetch
  const plan = extractPlanArtifact(input.artifacts, input.manuscript.sections)
  const body = {
    runId: input.runId,
    stepId: input.step.id,
    sectionId: input.step.sectionId ?? input.result.sectionId,
    agent: input.step.agent,
    attempt: input.step.attempt,
    manuscript: input.manuscript,
    profile: input.profile ?? null,
    planApproved: planLooksApprovable(plan, input.manuscript.workType),
    plan: plan ? toServicePlan(plan) : null,
    mentorComments: input.mentorComments ?? null,
    agentResult: input.result,
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs || 120_000)
  try {
    const response = await fetchImpl(`${config.url!.replace(/\/$/, '')}/v1/verify?wait=1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-katedra-worker-token': config.token! },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`gate verifier HTTP ${response.status}`)
    const parsed = await response.json() as { status?: string; result?: GateVerifierResponse }
    if (!parsed.result || !isGateResponse(parsed.result)) throw new Error('gate verifier: neispravan odgovor')
    return parsed.result
  } finally {
    clearTimeout(timer)
  }
}

function toServicePlan(plan: PlanArtifactV1): Record<string, unknown> {
  return {
    thesis: plan.thesis,
    question: plan.question,
    perspectives: plan.perspectives,
    chapters: plan.chapters.map((c) => ({ sectionId: c.sectionId, title: c.title, pages: c.pages, content: c.content, sources: c.sources })),
  }
}

function isGateResponse(value: unknown): value is GateVerifierResponse {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (!['verified', 'needs_revision', 'blocked', 'failed'].includes(String(v.status)) || !Array.isArray(v.issues)) return false
  if (!v.issues.every((issue) => issue && typeof issue === 'object'
    && typeof issue.code === 'string' && typeof issue.message === 'string' && typeof issue.blocking === 'boolean'
    && (issue.step === undefined || typeof issue.step === 'string'))) return false
  if (v.gate !== undefined) {
    if (!v.gate || typeof v.gate !== 'object') return false
    const gate = v.gate as Record<string, unknown>
    if (!['plan', 'pisanje', 'audit', 'predaja'].includes(String(gate.faza)) || typeof gate.prolaz !== 'boolean' || !Array.isArray(gate.koraci)) return false
    if (!gate.koraci.every((step) => step && typeof step === 'object' && typeof step.korak === 'string'
      && typeof step.stanje === 'string' && typeof step.blokira === 'boolean')) return false
  }
  return v.gateExitCode === undefined || (typeof v.gateExitCode === 'number' && Number.isInteger(v.gateExitCode))
}

const RANK: Record<VerificationResultV1['status'], number> = { verified: 0, needs_revision: 1, blocked: 2, failed: 3 }

/** Spoji Katedrinu (citati, evidence) i gate (sadržaj, proces) verifikaciju: stroži status pobjeđuje, issues se zbrajaju. */
export function mergeVerification(base: VerificationResultV1, gate: GateVerifierResponse): VerificationResultV1 {
  const gateIssues: VerificationIssue[] = gate.issues.map((issue) => ({
    code: mapGateCode(issue.code),
    message: issue.step ? `[gate:${issue.step}] ${issue.message}` : issue.message,
  }))
  const status = RANK[gate.status] > RANK[base.status] ? gate.status : base.status
  return { ...base, status, issues: [...base.issues, ...gateIssues] }
}

function mapGateCode(code: string): VerificationIssue['code'] {
  switch (code) {
    case 'gate_finding': return 'gate_finding'
    case 'gate_step_skipped': return 'gate_step_skipped'
    case 'gate_step_failed': return 'gate_step_failed'
    case 'gate_step_not_applicable':
    case 'gate_step_planned': return 'gate_step_skipped'
    default: return 'verifier_error'
  }
}

/**
 * Tvornica async verify handlera za processClaimedAgentStep. `baseVerify` je postojeći
 * verifyAgentResult; `loadContext` daje rukopis i artefakte (isti loaderi kao u provider-workeru).
 */
export function createGateBackedVerifier(input: {
  config: GateVerifierConfig
  runId: string
  baseVerify: (result: AgentResultV1) => VerificationResultV1
  loadContext: (context: { step: AgentStepRecord }) => Promise<{ manuscript: ManuscriptV1; artifacts: VerifiedAgentArtifactContext[] }>
  loadProfileHint?: (manuscript: ManuscriptV1) => Promise<DoctrineProfileHint | null>
  onGateResult?: (summary: Record<string, unknown>) => void
}) {
  return async (result: AgentResultV1, context: { step: AgentStepRecord }): Promise<VerificationResultV1> => {
    const base = input.baseVerify(result)
    if (base.status === 'failed') return base
    if (!isGateVerifierConfigured(input.config)) {
      if (input.config.required) {
        return { ...base, status: RANK[base.status] > RANK.needs_revision ? base.status : 'needs_revision', issues: [...base.issues, { code: 'verifier_error', message: 'Gate verifikator nije konfiguriran; korak se ne može potvrditi.' }] }
      }
      return { ...base, issues: [...base.issues, { code: 'gate_step_skipped', message: 'Gate verifikator nije konfiguriran; provjeren je samo citatni sloj.' }] }
    }
    try {
      const { manuscript, artifacts } = await input.loadContext(context)
      const profile = input.loadProfileHint ? await input.loadProfileHint(manuscript).catch(() => null) : null
      const gate = await callGateVerifier(input.config, { step: context.step, runId: input.runId, result, manuscript, artifacts, profile })
      input.onGateResult?.(gateSummaryForStorage(gate))
      return mergeVerification(base, gate)
    } catch {
      return { ...base, status: RANK[base.status] > RANK.needs_revision ? base.status : 'needs_revision', issues: [...base.issues, { code: 'verifier_error', message: 'Gate verifikator nije dostupan; korak se ne može potvrditi.' }] }
    }
  }
}
