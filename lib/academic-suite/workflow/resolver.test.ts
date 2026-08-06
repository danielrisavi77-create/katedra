import { describe, expect, it } from 'vitest'

import { resolveWorkflowForLegacySelection } from './resolver'
import type { WorkflowSnapshot } from './types'

const WORKFLOW: WorkflowSnapshot = {
  projectId: 'project-1',
  stage: 'DRAFTING',
  timeline: {
    targetSubmissionDate: '2026-09-15',
    targetDefenseDate: null,
    deadlineAuthority: {
      type: 'USER_REPORTED',
      sourceId: null,
      sourceLabel: null,
    },
  },
  mentor: {
    waitingForResponse: true,
    lastSentAt: '2026-08-05T12:00:00.000Z',
    lastSentVersionLabel: 'v3',
    lastSeenVersionLabel: 'v2',
    topicApproved: { value: true, authorityType: 'USER_REPORTED' },
    structureApproved: { value: null, authorityType: null },
    methodologyApproved: { value: null, authorityType: null },
    defenseApproved: { value: null, authorityType: null },
  },
  tasks: [],
  outcomes: { submittedAt: null, defendedAt: null },
  source: 'completion',
  updatedAt: '2026-08-06T12:00:00.000Z',
}

describe('resolveWorkflowForLegacySelection', () => {
  it('returns canonical Completion workflow when found', () => {
    expect(
      resolveWorkflowForLegacySelection('project-1', { kind: 'found', workflow: WORKFLOW }),
    ).toEqual({ workflowAuthority: 'completion', workflow: WORKFLOW })
  })

  it('returns compatibility mode when the legacy row has no canonical candidate', () => {
    expect(resolveWorkflowForLegacySelection('', null)).toEqual({
      workflowAuthority: 'legacy-compat',
      workflow: null,
    })
  })

  it('returns compatibility mode for an owned project without Completion state', () => {
    expect(resolveWorkflowForLegacySelection('project-1', { kind: 'missing-state' })).toEqual({
      workflowAuthority: 'legacy-compat',
      workflow: null,
    })
  })

  it('returns compatibility mode for an unresolved candidate from the authenticated legacy row', () => {
    expect(resolveWorkflowForLegacySelection('legacy-k-123', { kind: 'not-owned' })).toEqual({
      workflowAuthority: 'legacy-compat',
      workflow: null,
    })
  })

  it('never labels a non-found legacy result as Completion authority', () => {
    const cases = [
      resolveWorkflowForLegacySelection('project-1', { kind: 'missing-state' }),
      resolveWorkflowForLegacySelection('project-1', { kind: 'not-owned' }),
      resolveWorkflowForLegacySelection(null, null),
    ]

    for (const result of cases) {
      expect(result.workflowAuthority).toBe('legacy-compat')
      expect(result.workflow).toBeNull()
    }
  })
})
