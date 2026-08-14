export type WorkspaceViewPreference = 'home' | 'writing' | 'agents'

export function parseWorkspaceView(value: unknown): WorkspaceViewPreference | null {
  return value === 'home' || value === 'writing' || value === 'agents' ? value : null
}

export function initialWorkspaceView(input: { needsOnboarding: boolean; persistedView?: unknown }): WorkspaceViewPreference {
  if (input.needsOnboarding) return 'home'
  return parseWorkspaceView(input.persistedView) || 'home'
}
