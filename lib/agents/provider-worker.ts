import { createHash } from 'node:crypto'
import { buildAgentSystemPrompt, type DoctrineProfileHint } from './doctrine'
import { GATE_PHASE_FOR_AGENT } from './gate-verifier'

import { documentText } from '../manuscript/model'
import type { ManuscriptV1 } from '../manuscript/types'
import type { AgentInput, AgentProvider, AgentResultV1, ClaimEvidence, CitationEvidence } from './contracts'
import type { PassageVerificationResult } from './passage-verification'
import type { ProviderRouter } from './provider-router'
import { executeBilledAgentProvider, type BillingDatabase } from './billed-provider-execution'
import type { ProviderExecutionContext } from './provider-execution-recovery.server'
import type { AgentStepRecord } from './run-state'
import type { RunMaterialContext } from './run-context-loader'
import type { SourcePolicy } from './run-state'
import { selectVerifiedAgentArtifacts } from './artifact-chain'
import type { AgentStepResultPayloadV1 } from './run-result-storage'
import { logAgentEvent } from '../observability/agent-events'

const MAX_BILLING_REQUEST_ID_LENGTH = 100
const MAX_SECTION_CONTEXT_CHARS = 120_000
const MAX_MATERIAL_CONTEXT_CHARS = 50_000
const MAX_TOTAL_MATERIAL_CONTEXT_CHARS = 300_000
const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i

export function createProviderBackedExecutor(input: {
  projectId: string
  runId: string
  contextRevision: string
  loadContext: () => Promise<ManuscriptV1>
  loadMaterials?: () => Promise<RunMaterialContext[]>
  loadResults?: () => Promise<AgentStepResultPayloadV1[]>
  loadProfileHint?: (manuscript: ManuscriptV1) => Promise<DoctrineProfileHint | null>
  loadPolicyBlocked?: (manuscript: ManuscriptV1) => Promise<boolean>
  runMode?: 'guided' | 'accelerated' | 'autonomous'
  verifyCitations?: (citations: AgentResultV1['citations']) => Promise<AgentResultV1['citations']>
  verifyPassages?: (input: { projectId: string; runId: string; claims: ClaimEvidence[]; citations: CitationEvidence[]; requestId: string; agent: string; attempt: 1 | 2 | 3; execution: ProviderExecutionContext }) => Promise<ClaimEvidence[] | PassageVerificationResult>
  sourcePolicy?: SourcePolicy
  billing: { db: BillingDatabase; userId: string; model?: string; modelFor?: (provider: AgentProvider, step: AgentStepRecord) => string; requestIdFor?: (step: AgentStepRecord) => string }
  router: Pick<ProviderRouter, 'providerFor'>
}) {
  return async (step: AgentStepRecord): Promise<Omit<AgentResultV1, 'agent'>> => {
    const execution: ProviderExecutionContext = { contextRevision: input.contextRevision, stepId: step.id,
      workerId: step.executionLease?.workerId, stepClaimedAt: step.executionLease?.claimedAt }
    const manuscript = await input.loadContext()
    const activeSection = step.sectionId
      ? manuscript.sections.find((section) => section.id === step.sectionId)
      : undefined
    const materials = input.loadMaterials ? await input.loadMaterials() : []
    const results = input.loadResults ? await input.loadResults() : []
    const verifiedArtifacts = selectVerifiedAgentArtifacts(results, { ...step, projectId: input.projectId, runId: input.runId })
    const provider = input.router.providerFor(step.agent, capabilityFor(step.agent, input.sourcePolicy, materials))
    const model = input.billing.modelFor?.(provider, step) || provider.model || input.billing.model || provider.id
    const requestId = normalizeBillingRequestId(input.billing.requestIdFor?.(step) || `${input.runId}:${step.id}:${step.attempt}`)
    const startedAt = Date.now()
    const profileHint = input.loadProfileHint ? await input.loadProfileHint(manuscript).catch(() => null) : null
    const policyBlocked = input.loadPolicyBlocked ? await input.loadPolicyBlocked(manuscript).catch(() => false) : false
    const system = buildAgentSystemPrompt(step.agent, {
      workType: manuscript.workType,
      profile: profileHint,
      policyBlocked,
      runMode: input.runMode,
      gatePhase: GATE_PHASE_FOR_AGENT[step.agent],
    })
    const agentInput: AgentInput = {
      projectId: input.projectId,
      runId: input.runId,
      attempt: step.attempt,
      payload: buildProviderPayload(manuscript, step, materials, verifiedArtifacts, system),
    }
    try {
      const result = await executeBilledAgentProvider(input.billing.db, {
        provider,
        agentInput,
        execution,
        userId: input.billing.userId,
        projectId: input.projectId,
        requestId,
        agent: step.agent,
        model,
      })
      const inheritedCitations = citationBoundAgent(step.agent)
        ? manuscript.sources
          .filter((source) => source.verified && Boolean(source.urlOrDoi))
          .map((source) => citationFromSource(source))
        : []
      const inheritedArtifacts = citationBoundAgent(step.agent)
        ? verifiedArtifacts.flatMap((artifact) => artifact.citations)
        : []
      const candidateCitations = mergeCitations([...inheritedCitations, ...result.citations, ...inheritedArtifacts])
      const citations = input.verifyCitations ? await input.verifyCitations(candidateCitations) : candidateCitations
      const passageVerification = result.claims && input.verifyPassages
        ? await verifyPassagesWithTelemetry(input, step, requestId, result.claims, citations, execution)
        : undefined
      const claims = passageVerification?.claims || result.claims
      logAgentEvent({
        eventName: 'agent_provider_completed',
        requestId,
        userId: input.billing.userId,
        projectId: input.projectId,
        runId: input.runId,
        agent: step.agent,
        provider: result.provider,
        model,
        attempt: step.attempt,
        latencyMs: Date.now() - startedAt,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        citationCount: citations.length,
        inputArtifactCount: verifiedArtifacts.length,
        outcome: result.billingState || 'completed',
      })
      return {
        ...result,
        citations,
        ...(claims ? { claims } : {}),
        ...(verifiedArtifacts.length ? { inputArtifactIds: verifiedArtifacts.map((artifact) => artifact.artifactId) } : {}),
        ...(activeSection ? { sectionId: activeSection.id, baseRevision: activeSection.updatedAt } : {}),
      }
    } catch (error) {
      logAgentEvent({
        eventName: 'agent_provider_failed',
        requestId,
        userId: input.billing.userId,
        projectId: input.projectId,
        runId: input.runId,
        agent: step.agent,
        provider: provider.id,
        model,
        attempt: step.attempt,
        latencyMs: Date.now() - startedAt,
        inputArtifactCount: verifiedArtifacts.length,
        outcome: error instanceof Error ? error.name : 'unknown',
      })
      throw error
    }
  }
}

async function verifyPassagesWithTelemetry(
  input: {
    projectId: string
    runId: string
    verifyPassages?: (input: { projectId: string; runId: string; claims: ClaimEvidence[]; citations: CitationEvidence[]; requestId: string; agent: string; attempt: 1 | 2 | 3; execution: ProviderExecutionContext }) => Promise<ClaimEvidence[] | PassageVerificationResult>
    billing: { userId: string }
  },
  step: AgentStepRecord,
  requestId: string,
  claims: ClaimEvidence[],
  citations: CitationEvidence[],
  execution: ProviderExecutionContext,
): Promise<PassageVerificationResult> {
  const startedAt = Date.now()
  const verifierRequestId = `${requestId}:passage`
  try {
    const raw = await input.verifyPassages?.({
      projectId: input.projectId,
      runId: input.runId,
      claims,
      citations,
      requestId: verifierRequestId,
      agent: `${step.agent}_verifier`,
      attempt: step.attempt,
      execution,
    })
    const result = Array.isArray(raw)
      ? { claims: raw, provider: 'configured-passage-verifier', model: 'unknown', outcome: summarizePassageOutcome(raw) as PassageVerificationResult['outcome'] }
      : raw
    if (!result) throw new Error('Passage verifier nije vratio rezultat.')
    logAgentEvent({
      eventName: 'agent_passage_verifier_completed',
      requestId: verifierRequestId,
      billingRequestId: verifierRequestId,
      userId: input.billing.userId,
      projectId: input.projectId,
      runId: input.runId,
      agent: step.agent,
      provider: result.provider,
      model: result.model,
      attempt: step.attempt,
      latencyMs: Date.now() - startedAt,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      charged: result.charged,
      billingState: result.billingState,
      citationCount: citations.length,
      outcome: result.outcome,
      ...(result.usage ? {} : { reason: 'verifier_usage_missing' }),
    })
    return result
  } catch (error) {
    logAgentEvent({
      eventName: 'agent_passage_verifier_failed',
      requestId: verifierRequestId,
      billingRequestId: verifierRequestId,
      userId: input.billing.userId,
      projectId: input.projectId,
      runId: input.runId,
      agent: step.agent,
      attempt: step.attempt,
      latencyMs: Date.now() - startedAt,
      citationCount: citations.length,
      outcome: 'failed',
      reason: error instanceof Error ? error.name : 'unknown',
    })
    throw error
  }
}

function summarizePassageOutcome(claims: ClaimEvidence[]): PassageVerificationResult['outcome'] {
  const supports = claims.flatMap((claim) => claim.support || [])
  if (supports.some((support) => support.verification?.status === 'blocked')) return 'blocked'
  if (supports.length > 0 && supports.every((support) => support.verification?.status === 'verified')) return 'verified'
  return 'needs_review'
}

function normalizeBillingRequestId(value: string): string {
  const candidate = typeof value === 'string' ? value.trim() : ''
  if (candidate && candidate.length <= MAX_BILLING_REQUEST_ID_LENGTH) return candidate
  return `katedra-agent-${createHash('sha256').update(candidate || 'missing-request-id').digest('hex')}`
}

function citationFromSource(source: ManuscriptV1['sources'][number]) {
  const locator = source.urlOrDoi?.trim() || ''
  const numericYear = typeof source.year === 'number'
    ? source.year
    : typeof source.year === 'string' && /^\d{4}$/.test(source.year)
      ? Number(source.year)
      : undefined
  const base = { id: source.id, title: source.title, ...(source.authors ? { authors: source.authors } : {}), ...(numericYear ? { year: numericYear } : {}), verified: false as const }
  const doi = normalizeDoi(locator)
  return doi
    ? { ...base, doi }
    : { ...base, url: locator }
}

function normalizeDoi(value: string): string | null {
  const normalized = value.replace(/^doi:\s*/i, '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
  return DOI_PATTERN.test(normalized) ? normalized : null
}

function mergeCitations(citations: AgentResultV1['citations']): AgentResultV1['citations'] {
  const byId = new Map<string, AgentResultV1['citations'][number]>()
  for (const citation of citations) {
    const previous = byId.get(citation.id)
    if (!previous || (!previous.verified && citation.verified)) byId.set(citation.id, citation)
  }
  return [...byId.values()].slice(0, 100)
}

function buildProviderPayload(manuscript: ManuscriptV1, step: AgentStepRecord, materials: RunMaterialContext[], verifiedArtifacts: ReturnType<typeof selectVerifiedAgentArtifacts>, system: string) {
  const activeSection = step.sectionId
    ? manuscript.sections.find((section) => section.id === step.sectionId)
    : undefined
  const outline = manuscript.sections.map((section) => ({
    id: section.id,
    title: section.title,
    order: section.order,
    status: section.status,
  }))
  const scopedSection = activeSection
    ? { id: activeSection.id, title: activeSection.title, status: activeSection.status, text: clipText(documentText(activeSection.content), MAX_SECTION_CONTEXT_CHARS) }
    : undefined
  const sourceCandidates = manuscript.sources
    .filter((source) => Boolean(source.urlOrDoi))
    .map((source) => ({ id: source.id, title: source.title, authors: source.authors, year: source.year, urlOrDoi: source.urlOrDoi }))
  let materialChars = 0
  const materialContext = materials.flatMap((material) => {
    if (materialChars >= MAX_TOTAL_MATERIAL_CONTEXT_CHARS) return []
    const text = material.text === undefined ? undefined : clipText(material.text, Math.min(MAX_MATERIAL_CONTEXT_CHARS, MAX_TOTAL_MATERIAL_CONTEXT_CHARS - materialChars))
    materialChars += text?.length || 0
    return [{
      id: material.id,
      name: material.name,
      kind: material.kind,
      ...(text !== undefined ? { text } : {}),
      warnings: material.warnings,
    }]
  })
  const images = step.agent === 'intake' ? materials
    .filter((material) => material.image)
    .map((material) => ({ mimeType: material.image!.mimeType, data: material.image!.data }))
    : []
  const artifactContext = verifiedArtifacts.map((artifact) => ({
    artifactId: artifact.artifactId,
    stepId: artifact.stepId,
    agent: artifact.agent,
    verifier: artifact.verifier,
    stepOrder: artifact.stepOrder,
    attempt: artifact.attempt,
    output: artifact.output,
    citations: artifact.citations,
    ...(artifact.claims ? { claims: artifact.claims } : {}),
  }))

  return {
    system,
    messages: [{
      role: 'user' as const,
      content: JSON.stringify({
        contextRules: 'Radi samo s priloženim kontekstom. Ne izmišljaj izvore. Stavke u sourceCandidates su samo kandidati i nisu dokaz. Samo citati u verifiedAgentArtifacts smiju se tretirati kao prethodno verificirani. Tvrdnje bez provjerenog izvora označi za provjeru.',
        task: step.agent,
        attempt: step.attempt,
        project: { title: manuscript.title, workType: manuscript.workType, meta: manuscript.meta },
        outline,
        section: scopedSection,
        sourceCandidates,
        materials: materialContext,
        verifiedAgentArtifacts: artifactContext,
      }),
    }],
    ...(images.length ? { images } : {}),
    maxTokens: step.agent === 'writing' ? 4096 : 2048,
  }
}

function clipText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  return `${value.slice(0, Math.max(0, maxChars - 32))}\n[… kontekst je skraćen …]`
}

function capabilityFor(agent: AgentStepRecord['agent'], sourcePolicy?: SourcePolicy, materials: RunMaterialContext[] = []): AgentProvider['capabilities'][number] {
  if (agent === 'sources' && sourcePolicy === 'web_research') return 'web_research'
  if (agent === 'intake' && materials.some((material) => material.kind === 'scan')) return 'vision'
  return 'text'
}

function citationBoundAgent(agent: AgentStepRecord['agent']): boolean {
  return agent === 'sources' || agent === 'writing' || agent === 'citation' || agent === 'review'
}
