export interface ManualEditSnapshotState {
  sessionKey: string | null
  lastActivityAt: number | null
}

export interface ManualEditSnapshotDecision {
  shouldSnapshot: boolean
  nextState: ManualEditSnapshotState
}

export function manualEditSessionKey(projectId: string, sectionId: string): string {
  return `${projectId}:${sectionId}`
}

export function planManualEditSnapshot(input: {
  state: ManualEditSnapshotState
  projectId: string
  sectionId: string
  now: number
  idleMs?: number
}): ManualEditSnapshotDecision {
  const sessionKey = manualEditSessionKey(input.projectId, input.sectionId)
  const idleMs = input.idleMs ?? 1200
  const shouldSnapshot = input.state.sessionKey !== sessionKey
    || input.state.lastActivityAt === null
    || input.now - input.state.lastActivityAt >= idleMs

  return {
    shouldSnapshot,
    nextState: { sessionKey, lastActivityAt: input.now },
  }
}
