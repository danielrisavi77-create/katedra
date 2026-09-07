import { describe, expect, it } from 'vitest'
import { buildPlanReview, isPlanApprovalCurrent } from './plan-approval'
import { createManuscript } from '../manuscript/model'
import type { VerifiedAgentArtifactContext } from './artifact-chain'

const manuscript = createManuscript({ projectId: 'project-1', title: 'Topic', workType: 's' })
const artifact: VerifiedAgentArtifactContext = { artifactId: 'planning-1', stepId: 'planning', agent: 'planning', verifier: 'planning_verifier', stepOrder: 3, attempt: 1, citations: [],
  output: '<!-- PLAN:JSON -->{"thesis":"Thesis","chapters":[{"sectionId":"chapter-1","content":"Program","sources":["source-1"]}]}<!-- /PLAN:JSON -->' }
const review = buildPlanReview(manuscript, [artifact])
const expected = { userId: 'user-1', projectId: 'project-1', runId: 'run-1', planRevision: review.planRevision, now: Date.parse('2026-09-07T00:00:00Z') }
const approval = { schemaVersion: 1, approvedBy: 'user-1', projectId: 'project-1', runId: 'run-1', planRevision: review.planRevision, approvedAt: '2026-09-06T00:00:00Z' }

describe('explicit version-bound plan approval', () => {
  it('does not turn complete plan content or a boolean into user approval', () => {
    expect(review.ready).toBe(true)
    expect(isPlanApprovalCurrent(true, expected)).toBe(false)
    expect(isPlanApprovalCurrent(undefined, expected)).toBe(false)
    expect(isPlanApprovalCurrent(approval, expected)).toBe(true)
  })
  it.each(['approvedBy', 'projectId', 'runId', 'planRevision', 'approvedAt', 'schemaVersion'])('rejects a mismatched %s', (field) => {
    expect(isPlanApprovalCurrent({ ...approval, [field]: 'wrong' }, expected)).toBe(false)
  })
  it('rejects future approvals and a missing trusted owner', () => {
    expect(isPlanApprovalCurrent({ ...approval, approvedAt: '2099-01-01T00:00:00Z' }, expected)).toBe(false)
    expect(isPlanApprovalCurrent(approval, { ...expected, userId: undefined })).toBe(false)
  })
  it('invalidates approval after a new artifact or changed plan/outline', () => {
    for (const artifacts of [[{ ...artifact, attempt: 2 as const }], [{ ...artifact, output: artifact.output.replace('Program', 'Changed program') }]]) {
      const changed = buildPlanReview(manuscript, artifacts)
      expect(isPlanApprovalCurrent(approval, { ...expected, planRevision: changed.planRevision })).toBe(false)
    }
    expect(buildPlanReview({ ...manuscript, title: 'Changed topic' }, [artifact]).planRevision).not.toBe(review.planRevision)
    expect(buildPlanReview({ ...manuscript, sections: manuscript.sections.map((s) => ({ ...s, title: 'Changed chapter' })) }, [artifact]).planRevision).not.toBe(review.planRevision)
  })
})
