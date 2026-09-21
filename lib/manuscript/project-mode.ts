export type ProjectMode = 'manual' | 'autonomous'

const PROJECT_MODE_PREFIX = 'katedra_project_mode_v1:'

export function parseProjectMode(value: unknown): ProjectMode | null {
  return value === 'manual' || value === 'autonomous' ? value : null
}

export function restoreProjectMode(mode: ProjectMode | null, needsOnboarding: boolean, autonomousAvailable: boolean): ProjectMode | null {
  if (needsOnboarding) return null
  if (mode === 'autonomous' && !autonomousAvailable) return null
  return mode
}

export function projectModeStorageKey(projectId: string): string {
  return `${PROJECT_MODE_PREFIX}${projectId}`
}

export function projectModeWorkspaceView(mode: ProjectMode): 'writing' | 'agents' {
  return mode === 'autonomous' ? 'agents' : 'writing'
}

export function projectModeAllowsNavigation(mode: ProjectMode, item: string): boolean {
  if (mode === 'manual') return !['studio', 'review'].includes(item)
  return item !== 'writing'
}
