import { describe, expect, it } from 'vitest'

import { parseProjectMode, projectModeStorageKey, projectModeAllowsNavigation, projectModeWorkspaceView, restoreProjectMode, type ProjectMode } from './project-mode'

describe('project mode', () => {
  it('accepts only the two project-level workspaces', () => {
    expect(parseProjectMode('manual')).toBe('manual')
    expect(parseProjectMode('autonomous')).toBe('autonomous')
    expect(parseProjectMode('guided')).toBeNull()
    expect(parseProjectMode(null)).toBeNull()
  })

  it('names the persisted mode by canonical project id', () => {
    const mode: ProjectMode = 'autonomous'
    expect(projectModeStorageKey('project-42')).toBe('katedra_project_mode_v1:project-42')
    expect(mode).toBe('autonomous')
  })

  it('keeps the selected project inside its dedicated workspace', () => {
    expect(projectModeWorkspaceView('manual')).toBe('writing')
    expect(projectModeWorkspaceView('autonomous')).toBe('agents')
    expect(projectModeAllowsNavigation('manual', 'studio')).toBe(false)
    expect(projectModeAllowsNavigation('manual', 'review')).toBe(false)
    expect(projectModeAllowsNavigation('autonomous', 'writing')).toBe(false)
    expect(projectModeAllowsNavigation('autonomous', 'studio')).toBe(true)
  })

  it('does not resume an autonomous workspace when its server contract is unavailable', () => {
    expect(restoreProjectMode('autonomous', false, false)).toBeNull()
    expect(restoreProjectMode('autonomous', false, true)).toBe('autonomous')
    expect(restoreProjectMode('manual', true, true)).toBeNull()
  })
})
