import { createHash } from 'node:crypto'

import { documentText } from '../manuscript/model'
import type { ManuscriptV1 } from '../manuscript/types'
import type { AgentInput, AgentProvider, AgentResultV1 } from './contracts'
import type { ProviderRouter } from './provider-router'
import { executeBilledAgentProvider, type BillingDatabase } from './billed-provider-execution'
import type { AgentStepRecord } from './run-state'
import type { RunMaterialContext } from './run-context-loader'
import type { SourcePolicy } from './run-state'

const MAX_BILLING_REQUEST_ID_LENGTH = 100

export function createProviderBackedExecutor(input: {
  projectId: string
  runId: string
  loadContext: () => Promise<ManuscriptV1>
  loadMaterials?: () => Promise<RunMaterialContext[]>
  sourcePolicy?: SourcePolicy
  billing: { db: BillingDatabase; userId: string; model?: string; requestIdFor?: (step: AgentStepRecord) => string }
  router: Pick<ProviderRouter, 'providerFor'>
}) {
  return async (step: AgentStepRecord): Promise<Omit<AgentResultV1, 'agent'>> => {
    const manuscript = await input.loadContext()
    const activeSection = step.sectionId
      ? manuscript.sections.find((section) => section.id === step.sectionId)
      : undefined
    const materials = input.loadMaterials ? await input.loadMaterials() : []
    const provider = input.router.providerFor(step.agent, capabilityFor(step.agent, input.sourcePolicy, materials))
    const agentInput: AgentInput = {
      projectId: input.projectId,
      runId: input.runId,
      attempt: step.attempt,
      payload: buildProviderPayload(manuscript, step, materials),
    }
    const result = await executeBilledAgentProvider(input.billing.db, {
      provider,
      agentInput,
      userId: input.billing.userId,
      projectId: input.projectId,
      requestId: normalizeBillingRequestId(input.billing.requestIdFor?.(step) || `${input.runId}:${step.id}:${step.attempt}`),
      model: input.billing.model || provider.id,
    })
    return {
      ...result,
      citations: manuscript.sources
        .filter((source) => source.verified && Boolean(source.urlOrDoi))
        .map((source) => citationFromSource(source)),
      ...(activeSection ? { sectionId: activeSection.id, baseRevision: activeSection.updatedAt } : {}),
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
  const base = { id: source.id, title: source.title, verified: true as const }
  return /^10\.\d{4,9}\/\S+$/i.test(locator)
    ? { ...base, doi: locator }
    : { ...base, url: locator }
}

function buildProviderPayload(manuscript: ManuscriptV1, step: AgentStepRecord, materials: RunMaterialContext[]) {
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
    ? { id: activeSection.id, title: activeSection.title, status: activeSection.status, text: documentText(activeSection.content) }
    : undefined
  const verifiedSources = manuscript.sources
    .filter((source) => source.verified && Boolean(source.urlOrDoi))
    .map((source) => ({ id: source.id, title: source.title, authors: source.authors, year: source.year, urlOrDoi: source.urlOrDoi }))
  const materialContext = materials.map((material) => ({
    id: material.id,
    name: material.name,
    kind: material.kind,
    text: material.text,
    warnings: material.warnings,
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
      }),
    }],
    maxTokens: step.agent === 'writing' ? 4096 : 2048,
  }
}

function capabilityFor(agent: AgentStepRecord['agent'], sourcePolicy?: SourcePolicy, materials: RunMaterialContext[] = []): AgentProvider['capabilities'][number] {
  if (agent === 'sources' && sourcePolicy === 'web_research') return 'web_research'
  if (agent === 'intake' && materials.some((material) => material.kind === 'scan')) return 'vision'
  return 'text'
}
