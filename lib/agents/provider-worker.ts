import { createHash } from 'node:crypto'

import { documentText } from '../manuscript/model'
import type { ManuscriptV1 } from '../manuscript/types'
import type { AgentInput, AgentProvider, AgentResultV1 } from './contracts'
import type { ProviderRouter } from './provider-router'
import { executeBilledAgentProvider, type BillingDatabase } from './billed-provider-execution'
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

export function createProviderBackedExecutor(input: {
  projectId: string
  runId: string
  loadContext: () => Promise<ManuscriptV1>
  loadMaterials?: () => Promise<RunMaterialContext[]>
  loadResults?: () => Promise<AgentStepResultPayloadV1[]>
  verifyCitations?: (citations: AgentResultV1['citations']) => Promise<AgentResultV1['citations']>
  sourcePolicy?: SourcePolicy
  billing: { db: BillingDatabase; userId: string; model?: string; modelFor?: (provider: AgentProvider, step: AgentStepRecord) => string; requestIdFor?: (step: AgentStepRecord) => string }
  router: Pick<ProviderRouter, 'providerFor'>
}) {
  return async (step: AgentStepRecord): Promise<Omit<AgentResultV1, 'agent'>> => {
    const manuscript = await input.loadContext()
    const activeSection = step.sectionId
      ? manuscript.sections.find((section) => section.id === step.sectionId)
      : undefined
    const materials = input.loadMaterials ? await input.loadMaterials() : []
    const results = input.loadResults ? await input.loadResults() : []
    const verifiedArtifacts = selectVerifiedAgentArtifacts(results, { ...step, projectId: input.projectId, runId: input.runId })
    const provider = input.router.providerFor(step.agent, capabilityFor(step.agent, input.sourcePolicy, materials))
    const requestId = normalizeBillingRequestId(input.billing.requestIdFor?.(step) || `${input.runId}:${step.id}:${step.attempt}`)
    const startedAt = Date.now()
    const agentInput: AgentInput = {
      projectId: input.projectId,
      runId: input.runId,
      attempt: step.attempt,
      payload: buildProviderPayload(manuscript, step, materials, verifiedArtifacts),
    }
    try {
      const result = await executeBilledAgentProvider(input.billing.db, {
        provider,
        agentInput,
        userId: input.billing.userId,
        projectId: input.projectId,
        requestId,
        agent: step.agent,
        model: input.billing.modelFor?.(provider, step) || provider.model || input.billing.model || provider.id,
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
      logAgentEvent({
        eventName: 'agent_provider_completed',
        requestId,
        userId: input.billing.userId,
        projectId: input.projectId,
        runId: input.runId,
        agent: step.agent,
        provider: result.provider,
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
        attempt: step.attempt,
        latencyMs: Date.now() - startedAt,
        inputArtifactCount: verifiedArtifacts.length,
        outcome: error instanceof Error ? error.name : 'unknown',
      })
      throw error
    }
  }
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
  const base = { id: source.id, title: source.title, ...(source.authors ? { authors: source.authors } : {}), ...(numericYear ? { year: numericYear } : {}), verified: true as const }
  return /^10\.\d{4,9}\/\S+$/i.test(locator)
    ? { ...base, doi: locator }
    : { ...base, url: locator }
}

function mergeCitations(citations: AgentResultV1['citations']): AgentResultV1['citations'] {
  const byId = new Map<string, AgentResultV1['citations'][number]>()
  for (const citation of citations) {
    const previous = byId.get(citation.id)
    if (!previous || (!previous.verified && citation.verified)) byId.set(citation.id, citation)
  }
  return [...byId.values()].slice(0, 100)
}

function buildProviderPayload(manuscript: ManuscriptV1, step: AgentStepRecord, materials: RunMaterialContext[], verifiedArtifacts: ReturnType<typeof selectVerifiedAgentArtifacts>) {
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
  const verifiedSources = manuscript.sources
    .filter((source) => source.verified && Boolean(source.urlOrDoi))
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
    system: 'Radi samo s priloženim kontekstom. Ne izmišljaj izvore. Tvrdnje bez provjerenog izvora označi za provjeru.',
    messages: [{
      role: 'user' as const,
      content: JSON.stringify({
        task: step.agent,
        attempt: step.attempt,
        project: { title: manuscript.title, workType: manuscript.workType, meta: manuscript.meta },
        outline,
        section: scopedSection,
        verifiedSources,
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
