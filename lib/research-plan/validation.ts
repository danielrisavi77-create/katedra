import type {
  ResearchPlanDesignV1,
  ResearchPlanFieldV1,
  ResearchPlanMethodologyV1,
  ResearchPlanSnapshotV1,
  ResearchPlanStatus,
  ResearchPlanV1,
} from './types'
import { RESEARCH_PLAN_SCHEMA_VERSION } from './types'

const MAX_TEXT = 5_000
const MAX_REPEATED_TEXT = 1_000
const MAX_REPEATED_FIELDS = 20
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const STATUSES: readonly ResearchPlanStatus[] = ['empty', 'draft', 'review', 'approved']

export type ResearchPlanValidation =
  | { ok: true; value: ResearchPlanV1 }
  | { ok: false; error: string }

export type ResearchPlanTransition = ResearchPlanValidation

const DESIGN_KEYS = ['problem', 'goal', 'researchQuestion', 'hypotheses', 'variables', 'cases', 'expectedContribution'] as const
const METHODOLOGY_KEYS = ['design', 'sample', 'operationalization', 'instrument', 'analysis', 'limitations', 'ethics'] as const
const FIELD_KEYS = ['id', 'value', 'updatedAt'] as const

export function createEmptyResearchPlan(projectId: string, now = new Date().toISOString()): ResearchPlanV1 {
  return {
    schemaVersion: RESEARCH_PLAN_SCHEMA_VERSION,
    projectId,
    status: 'empty',
    design: {
      problem: '',
      goal: '',
      researchQuestion: '',
      hypotheses: [],
      variables: [],
      cases: [],
      expectedContribution: '',
    },
    methodology: {
      design: '',
      sample: '',
      operationalization: '',
      instrument: '',
      analysis: '',
      limitations: '',
      ethics: '',
    },
    createdAt: now,
    updatedAt: now,
    revision: `${now}:0`,
  }
}

export function validateResearchPlan(value: unknown, projectId: string): ResearchPlanValidation {
  if (!isRecord(value)) return invalid('Plan nije objekt.')
  if (value.schemaVersion !== RESEARCH_PLAN_SCHEMA_VERSION) return invalid('Nepodržana verzija istraživačkog plana.')
  if (value.projectId !== projectId || typeof projectId !== 'string' || !projectId.trim()) return invalid('Plan ne pripada ovom projektu.')
  if (!isStatus(value.status)) return invalid('Status plana nije valjan.')
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt) || typeof value.revision !== 'string' || !value.revision.trim()) return invalid('Vrijeme ili revizija plana nisu valjani.')
  if (!isExactKeys(value.design, DESIGN_KEYS) || !isExactKeys(value.methodology, METHODOLOGY_KEYS)) return invalid('Struktura plana nije valjana.')

  const design = value.design as Record<string, unknown>
  const methodology = value.methodology as Record<string, unknown>
  const designTextFields: Array<[string, unknown]> = [
    ['problem', design.problem], ['goal', design.goal], ['researchQuestion', design.researchQuestion], ['expectedContribution', design.expectedContribution],
  ]
  for (const [name, field] of designTextFields) if (!validText(field, MAX_TEXT)) return invalid(`Polje ${name} nije valjano.`)
  for (const name of METHODOLOGY_KEYS) if (!validText(methodology[name], MAX_TEXT)) return invalid(`Metodološko polje ${name} nije valjano.`)

  const repeated: Array<[string, unknown]> = [['hypotheses', design.hypotheses], ['variables', design.variables], ['cases', design.cases]]
  for (const [name, fields] of repeated) {
    if (!Array.isArray(fields) || fields.length > MAX_REPEATED_FIELDS) return invalid(`Zbirka ${name} nije valjana.`)
    for (const field of fields) if (!isValidRepeatedField(field)) return invalid(`Zapis u zbirci ${name} nije valjan.`)
  }

  const plan = value as unknown as ResearchPlanV1
  if ((plan.status === 'review' || plan.status === 'approved') && !isReadyForReview(plan)) return invalid('Plan nema sva obavezna polja za pregled.')
  return { ok: true, value: plan }
}

export function isReadyForReview(plan: ResearchPlanV1): boolean {
  const required = [
    plan.design.problem,
    plan.design.goal,
    plan.design.researchQuestion,
    plan.methodology.design,
    plan.methodology.sample,
    plan.methodology.operationalization,
    plan.methodology.instrument,
    plan.methodology.analysis,
    plan.methodology.limitations,
    plan.methodology.ethics,
  ]
  return required.every((value) => typeof value === 'string' && value.trim().length > 0)
}

export function transitionResearchPlan(plan: ResearchPlanV1, nextStatus: ResearchPlanStatus, now = new Date().toISOString()): ResearchPlanTransition {
  if (!STATUSES.includes(nextStatus)) return invalid('Sljedeći status plana nije valjan.')
  if (!isAllowedTransition(plan.status, nextStatus)) return invalid('Ovaj prijelaz statusa nije dopušten.')
  const candidate: ResearchPlanV1 = { ...plan, status: nextStatus, updatedAt: now, revision: `${now}:${plan.revision}` }
  const validation = validateResearchPlan(candidate, plan.projectId)
  return validation.ok ? validation : validation
}

export function isValidResearchPlanSnapshot(snapshot: unknown, projectId: string): snapshot is ResearchPlanSnapshotV1 {
  if (!isRecord(snapshot) || snapshot.projectId !== projectId || typeof snapshot.id !== 'string' || typeof snapshot.reason !== 'string' || !isIsoDate(snapshot.createdAt)) return false
  return validateResearchPlan(snapshot.plan, projectId).ok
}

function isAllowedTransition(current: ResearchPlanStatus, next: ResearchPlanStatus): boolean {
  if (current === next) return true
  return (
    (current === 'empty' && next === 'draft') ||
    (current === 'draft' && next === 'review') ||
    (current === 'review' && (next === 'draft' || next === 'approved')) ||
    (current === 'approved' && next === 'draft')
  )
}

function isValidRepeatedField(value: unknown): value is ResearchPlanFieldV1 {
  return isRecord(value) && isExactKeys(value, FIELD_KEYS) && typeof value.id === 'string' && Boolean(value.id.trim()) && validText(value.value, MAX_REPEATED_TEXT) && value.value.trim().length > 0 && isIsoDate(value.updatedAt)
}

function validText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max
}

function isStatus(value: unknown): value is ResearchPlanStatus {
  return typeof value === 'string' && STATUSES.includes(value as ResearchPlanStatus)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))
}

function isExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function invalid(error: string): { ok: false; error: string } {
  return { ok: false, error }
}
