import { createHash } from 'node:crypto'
import type { ManuscriptV1 } from '../manuscript/types'
import type { VerifiedAgentArtifactContext } from './artifact-chain'
import { extractPlanArtifact, planLooksApprovable } from './plan-artifact'

export interface PlanApprovalV1 {
  schemaVersion: 1
  runId: string
  projectId: string
  planRevision: string
  approvedBy: string
  approvedAt: string
}

export function buildPlanReview(manuscript: ManuscriptV1, artifacts: readonly VerifiedAgentArtifactContext[]) {
  const plan = extractPlanArtifact(artifacts, manuscript.sections)
  const planArtifacts = artifacts.filter((artifact) => ['structure', 'planning'].includes(artifact.agent))
    .map(({ artifactId, stepId, attempt }) => ({ artifactId, stepId, attempt })).sort((a, b) => a.stepId.localeCompare(b.stepId))
  const scope = { projectId: manuscript.projectId, title: manuscript.title, workType: manuscript.workType,
    sections: manuscript.sections.map(({ id, title, kind, order }) => ({ id, title, kind, order })),
    sources: manuscript.sources.map(({ id, title, authors, year, urlOrDoi }) => ({ id, title, authors, year, urlOrDoi })),
    plan, planArtifacts }
  const planRevision = createHash('sha256').update(JSON.stringify(scope)).digest('hex')
  return { plan, planRevision, ready: planLooksApprovable(plan, manuscript.workType) }
}

export function isPlanApprovalCurrent(value: unknown, expected: {
  userId?: string; projectId: string; runId: string; planRevision: string; now?: number
}): value is PlanApprovalV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !expected.userId) return false
  const approval = value as Record<string, unknown>
  const approvedAt = typeof approval.approvedAt === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(approval.approvedAt) ? Date.parse(approval.approvedAt) : NaN
  return approval.schemaVersion === 1 && approval.approvedBy === expected.userId
    && approval.projectId === expected.projectId && approval.runId === expected.runId
    && /^[a-f0-9]{64}$/.test(String(approval.planRevision)) && approval.planRevision === expected.planRevision
    && Number.isFinite(approvedAt) && approvedAt <= (expected.now ?? Date.now())
}

export class PlanApprovalRequiredError extends Error {
  constructor() { super('Plan approval required'); this.name = 'PlanApprovalRequiredError' }
}
