export type WorkflowAuthority = 'completion' | 'legacy-compat'

export type ApprovalSnapshot = {
  value: boolean | null
  authorityType: string | null
}

export type WorkflowTaskSnapshot = {
  id: string
  type: string
  title: string
  status: string
  priority: string
  stage: string
  authority: {
    type: string
    sourceId: string | null
    sourceLabel: string | null
  }
}

export type WorkflowSnapshot = {
  projectId: string
  stage: string
  timeline: {
    targetSubmissionDate: string | null
    targetDefenseDate: string | null
    deadlineAuthority: {
      type: string
      sourceId: string | null
      sourceLabel: string | null
    }
  }
  mentor: {
    waitingForResponse: boolean
    lastSentAt: string | null
    lastSentVersionLabel: string | null
    lastSeenVersionLabel: string | null
    topicApproved: ApprovalSnapshot
    structureApproved: ApprovalSnapshot
    methodologyApproved: ApprovalSnapshot
    defenseApproved: ApprovalSnapshot
  }
  tasks: WorkflowTaskSnapshot[]
  outcomes: {
    submittedAt: string | null
    defendedAt: string | null
  }
  source: 'completion'
  updatedAt: string
}

export type WorkflowLoadResult =
  | { kind: 'found'; workflow: WorkflowSnapshot }
  | { kind: 'missing-state' }
  | { kind: 'not-owned' }

export type WorkflowResolution =
  | { workflowAuthority: 'completion'; workflow: WorkflowSnapshot }
  | { workflowAuthority: 'legacy-compat'; workflow: null }
