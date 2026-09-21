export type WorkspaceMode = 'preparation' | 'running' | 'intervention' | 'review' | 'writing'

export type WorkspaceRunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'blocked' | 'failed' | 'cancelled'

export interface WorkspaceRunSummary {
  runId: string
  status: WorkspaceRunStatus
  activeStepId?: string
  activeAgent?: string
  activeVerifier?: string
  verifiedSections: number
  blockedSections: number
  totalSteps: number
}

export function deriveWorkspaceMode(input: {
  hasActiveRun: boolean
  run?: WorkspaceRunSummary | null
  hasPendingReview: boolean
  hasManuscript: boolean
}): WorkspaceMode {
  if (!input.hasManuscript) return 'preparation'

  if (input.hasActiveRun) {
    if (!input.run) return 'intervention'
    return modeForRun(input.run.status, input.hasPendingReview)
  }

  if (input.hasPendingReview) return 'review'
  if (input.run?.status === 'blocked' || input.run?.status === 'failed' || input.run?.status === 'cancelled') {
    return 'intervention'
  }
  return 'writing'
}

function modeForRun(status: unknown, hasPendingReview: boolean): WorkspaceMode {
  switch (status) {
    case 'pending':
    case 'running':
    case 'paused':
      return 'running'
    case 'completed':
      return hasPendingReview ? 'review' : 'writing'
    case 'blocked':
    case 'failed':
    case 'cancelled':
      return 'intervention'
    default:
      return 'intervention'
  }
}
