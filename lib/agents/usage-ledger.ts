export type AiUsageBillingState = 'settled' | 'released' | 'pending_reconciliation' | 'unknown'
export type AiUsageAppliedState = 'accepted' | 'rejected' | 'pending' | 'not_applicable'

export interface AiUsageLedgerRow {
  stepId: string
  agent: string
  phase: string
  verifier: string
  attempt: number
  status: string
  provider?: string
  inputTokens: number
  outputTokens: number
  billingState: AiUsageBillingState
  applied: AiUsageAppliedState
  occurredAt?: string
}

export interface AiUsageLedgerV1 {
  schemaVersion: 1
  projectId: string
  runId: string
  mode?: string
  generatedAt: string
  totals: {
    calls: number
    inputTokens: number
    outputTokens: number
    pendingBilling: number
  }
  rows: AiUsageLedgerRow[]
}

export interface AiUsageLedgerInput {
  projectId: string
  runId: string
  mode?: unknown
  steps: ReadonlyArray<Record<string, unknown>>
  results: ReadonlyArray<Record<string, unknown>>
  appliedSectionIds?: ReadonlyArray<string>
  rejectedSectionIds?: ReadonlyArray<string>
  now?: string
}

const MAX_ROWS = 100

const PHASE_LABELS: Record<string, string> = {
  intake: 'Analiza materijala',
  sources: 'Literatura',
  structure: 'Struktura rada',
  planning: 'Plan rada',
  writing: 'Pisanje',
  citation: 'Provjera izvora',
  review: 'Provjera rada',
  export: 'Priprema za izvoz',
}

const STATUSES = new Set(['pending', 'running', 'retrying', 'verified', 'completed', 'blocked', 'failed', 'paused', 'cancelled', 'generated', 'needs_revision'])
const BILLING_STATES = new Set<AiUsageBillingState>(['settled', 'released', 'pending_reconciliation'])

/**
 * Builds a user-readable operational record. Deliberately projects only
 * metadata: provider output, prompts, manuscript text and source evidence are
 * never copied into this object.
 */
export function buildAiUsageLedger(input: AiUsageLedgerInput): AiUsageLedgerV1 {
  const applied = new Set(input.appliedSectionIds || [])
  const rejected = new Set(input.rejectedSectionIds || [])
  const stepById = new Map(input.steps.map((step, index) => [stepId(step, `step-${index + 1}`), step]))
  const coveredStepIds = new Set<string>()
  const seenResults = new Set<string>()
  const rows: AiUsageLedgerRow[] = []

  input.results.forEach((result, index) => {
    if (rows.length >= MAX_ROWS) return
    const matchingStep = stepById.get(stepId(result, ''))
    const id = stepId(result, `result-${index + 1}`)
    const materialId = stringValue(result.materialId) || stringValue(result.material_id)
    const dedupeKey = materialId || `${id}:${attempt(result)}:${stringValue(result.createdAt) || index}`
    if (seenResults.has(dedupeKey)) return
    seenResults.add(dedupeKey)
    if (matchingStep) coveredStepIds.add(id)
    rows.push(rowFromResult(result, matchingStep, id, applied, rejected))
  })

  input.steps.forEach((step, index) => {
    if (rows.length >= MAX_ROWS) return
    const id = stepId(step, `step-${index + 1}`)
    if (coveredStepIds.has(id)) return
    rows.push(rowFromStep(step, id))
  })

  const totals = rows.reduce((summary, row) => ({
    calls: summary.calls + 1,
    inputTokens: summary.inputTokens + row.inputTokens,
    outputTokens: summary.outputTokens + row.outputTokens,
    pendingBilling: summary.pendingBilling + (row.billingState === 'pending_reconciliation' ? 1 : 0),
  }), { calls: 0, inputTokens: 0, outputTokens: 0, pendingBilling: 0 })

  return {
    schemaVersion: 1,
    projectId: stringValue(input.projectId) || 'unknown-project',
    runId: stringValue(input.runId) || 'unknown-run',
    ...(stringValue(input.mode) ? { mode: stringValue(input.mode) } : {}),
    generatedAt: stringValue(input.now) || new Date().toISOString(),
    totals,
    rows,
  }
}

function rowFromResult(result: Record<string, unknown>, step: Record<string, unknown> | undefined, id: string, applied: Set<string>, rejected: Set<string>): AiUsageLedgerRow {
  const agent = safeLabel(stringValue(result.agent) || stringValue(step?.agent), 'unknown')
  const sectionId = stringValue(result.sectionId) || stringValue(result.section_id)
  const status = normalizedStatus(result.verification && isRecord(result.verification) ? result.verification.status : result.status, 'generated')
  return {
    stepId: safeLabel(id, 'unknown-step'),
    agent,
    phase: PHASE_LABELS[agent] || humanize(agent),
    verifier: safeLabel(stringValue(result.verifier) || stringValue(step?.verifier), `${agent}_verifier`),
    attempt: attempt(result),
    status,
    ...providerValue(result, step),
    ...readUsage(result.usage || step?.usage),
    billingState: billingState(result.billingState || result.billing_state),
    applied: appliedState(sectionId, status, applied, rejected),
    ...occurredAt(result.createdAt || result.created_at || result.completedAt || result.completed_at),
  }
}

function rowFromStep(step: Record<string, unknown>, id: string): AiUsageLedgerRow {
  const agent = safeLabel(stringValue(step.agent), 'unknown')
  return {
    stepId: safeLabel(id, 'unknown-step'),
    agent,
    phase: PHASE_LABELS[agent] || humanize(agent),
    verifier: safeLabel(stringValue(step.verifier), `${agent}_verifier`),
    attempt: attempt(step),
    status: normalizedStatus(step.status, 'pending'),
    ...providerValue(step),
    ...readUsage(step.usage),
    billingState: billingState(step.billingState || step.billing_state),
    applied: 'not_applicable',
    ...occurredAt(step.occurredAt || step.occurred_at || step.updatedAt || step.updated_at),
  }
}

function appliedState(sectionId: string, status: string, applied: Set<string>, rejected: Set<string>): AiUsageAppliedState {
  if (!sectionId) return 'not_applicable'
  if (rejected.has(sectionId)) return 'rejected'
  if (applied.has(sectionId)) return 'accepted'
  return ['verified', 'completed', 'generated', 'needs_revision', 'blocked'].includes(status) ? 'pending' : 'not_applicable'
}

function providerValue(primary: Record<string, unknown>, fallback?: Record<string, unknown>): { provider?: string } {
  const provider = stringValue(primary.provider) || stringValue(fallback?.provider)
  return provider ? { provider: safeLabel(provider, 'unknown') } : {}
}

function readUsage(value: unknown): { inputTokens: number; outputTokens: number } {
  if (!isRecord(value)) return { inputTokens: 0, outputTokens: 0 }
  return {
    inputTokens: nonNegativeInteger(value.inputTokens ?? value.input_tokens),
    outputTokens: nonNegativeInteger(value.outputTokens ?? value.output_tokens),
  }
}

function billingState(value: unknown): AiUsageBillingState {
  const normalized = stringValue(value) as AiUsageBillingState
  return BILLING_STATES.has(normalized) ? normalized : 'unknown'
}

function normalizedStatus(value: unknown, fallback: string): string {
  const normalized = stringValue(value)
  return STATUSES.has(normalized) ? normalized : fallback
}

function attempt(value: Record<string, unknown>): number {
  const number = Number(value.attempt)
  return Number.isFinite(number) && number >= 1 ? Math.min(3, Math.floor(number)) : 1
}

function nonNegativeInteger(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

function occurredAt(value: unknown): { occurredAt?: string } {
  const timestamp = stringValue(value)
  return timestamp ? { occurredAt: timestamp.slice(0, 80) } : {}
}

function stepId(value: Record<string, unknown>, fallback: string): string {
  return stringValue(value.stepId) || stringValue(value.step_id) || stringValue(value.id) || fallback
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function safeLabel(value: string, fallback: string): string {
  return (value || fallback).slice(0, 100)
}

function humanize(value: string): string {
  return value.replace(/[_-]+/gu, ' ').trim().replace(/\b\w/gu, (letter) => letter.toUpperCase()) || 'Sljedeći korak'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
