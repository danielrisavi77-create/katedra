export type ResearchPlanAccessDecision = {
  allowed: boolean
  code?: string
  tier?: string
  projectId?: string
}

export type ResearchPlanAccess = {
  researchDesign: ResearchPlanAccessDecision
  methodology: ResearchPlanAccessDecision
}

export function researchPlanTabVisible(access: ResearchPlanAccess | null | undefined): boolean {
  return Boolean(access?.researchDesign.allowed && access?.methodology.allowed)
}
