import { describe, expect, it } from 'vitest'

import { initialWorkspaceView, parseWorkspaceView, type WorkspaceViewPreference } from './workspace-view'

describe('workspace view persistence', () => {
  it('accepts only known persisted views', () => {
    expect(parseWorkspaceView('writing')).toBe('writing')
    expect(parseWorkspaceView('agents')).toBe('agents')
    expect(parseWorkspaceView('home')).toBe('home')
    expect(parseWorkspaceView('dashboard')).toBeNull()
    expect(parseWorkspaceView(null)).toBeNull()
  })

  it('opens a returning project in its last workspace instead of restarting at home', () => {
    expect(initialWorkspaceView({ needsOnboarding: false, persistedView: 'writing' })).toBe('writing')
    expect(initialWorkspaceView({ needsOnboarding: false, persistedView: 'agents' })).toBe('agents')
    expect(initialWorkspaceView({ needsOnboarding: false, persistedView: 'home' })).toBe('home')
  })

  it('always starts new or incomplete projects in onboarding', () => {
    const views: WorkspaceViewPreference[] = ['home', 'writing', 'agents']
    views.forEach((persistedView) => {
      expect(initialWorkspaceView({ needsOnboarding: true, persistedView })).toBe('home')
    })
  })
})
