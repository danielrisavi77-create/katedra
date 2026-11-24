import type { ResearchPlanV1 } from './types'

const MAX_FIELD = 1_500
const MAX_ITEMS = 10

export function serializeResearchPlanContext(plan: ResearchPlanV1 | null | undefined) {
  if (!plan) return null
  return {
    status: plan.status,
    design: {
      problem: clip(plan.design.problem),
      goal: clip(plan.design.goal),
      researchQuestion: clip(plan.design.researchQuestion),
      hypotheses: plan.design.hypotheses.slice(0, MAX_ITEMS).map((field) => clip(field.value)).filter(Boolean),
      variables: plan.design.variables.slice(0, MAX_ITEMS).map((field) => clip(field.value)).filter(Boolean),
      cases: plan.design.cases.slice(0, MAX_ITEMS).map((field) => clip(field.value)).filter(Boolean),
      expectedContribution: clip(plan.design.expectedContribution),
    },
    methodology: {
      design: clip(plan.methodology.design),
      sample: clip(plan.methodology.sample),
      operationalization: clip(plan.methodology.operationalization),
      instrument: clip(plan.methodology.instrument),
      analysis: clip(plan.methodology.analysis),
      limitations: clip(plan.methodology.limitations),
      ethics: clip(plan.methodology.ethics),
    },
  }
}

function clip(value: string): string {
  return value.trim().slice(0, MAX_FIELD)
}
