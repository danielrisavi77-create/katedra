export const RESEARCH_PLAN_SCHEMA_VERSION = 1 as const

export type ResearchPlanStatus = 'empty' | 'draft' | 'review' | 'approved'

export interface ResearchPlanFieldV1 {
  id: string
  value: string
  updatedAt: string
}

export interface ResearchPlanDesignV1 {
  problem: string
  goal: string
  researchQuestion: string
  hypotheses: ResearchPlanFieldV1[]
  variables: ResearchPlanFieldV1[]
  cases: ResearchPlanFieldV1[]
  expectedContribution: string
}

export interface ResearchPlanMethodologyV1 {
  design: string
  sample: string
  operationalization: string
  instrument: string
  analysis: string
  limitations: string
  ethics: string
}

export interface ResearchPlanV1 {
  schemaVersion: typeof RESEARCH_PLAN_SCHEMA_VERSION
  projectId: string
  status: ResearchPlanStatus
  design: ResearchPlanDesignV1
  methodology: ResearchPlanMethodologyV1
  createdAt: string
  updatedAt: string
  revision: string
}

export interface ResearchPlanSnapshotV1 {
  id: string
  projectId: string
  reason: string
  createdAt: string
  plan: ResearchPlanV1
}
