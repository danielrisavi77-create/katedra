export type WorkspaceViewPreference = 'home' | 'writing' | 'agents'
export type AgenticWorkspacePhase = 'preparation' | 'dashboard' | 'intervention' | 'review'

export function parseWorkspaceView(value: unknown): WorkspaceViewPreference | null {
  return value === 'home' || value === 'writing' || value === 'agents' ? value : null
}

export function initialWorkspaceView(input: { needsOnboarding: boolean; persistedView?: unknown; projectMode?: 'manual' | 'autonomous' | null }): WorkspaceViewPreference {
  if (input.needsOnboarding) return 'home'
  return parseWorkspaceView(input.persistedView) || (input.projectMode === 'autonomous' ? 'agents' : 'home')
}

export function parseAgenticWorkspacePhase(value: unknown): AgenticWorkspacePhase | null {
  return value === 'preparation' || value === 'dashboard' || value === 'intervention' || value === 'review' ? value : null
}

export function initialAgenticWorkspacePhase(persistedPhase?: unknown): AgenticWorkspacePhase {
  return parseAgenticWorkspacePhase(persistedPhase) || 'preparation'
}

export function nextAgenticWorkspacePhase(selectedPhase: AgenticWorkspacePhase, emittedPhase: AgenticWorkspacePhase): AgenticWorkspacePhase {
  return selectedPhase === 'review' && emittedPhase === 'dashboard' ? 'review' : emittedPhase
}
