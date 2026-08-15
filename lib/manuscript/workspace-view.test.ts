import { describe, expect, it } from 'vitest'

import { initialAgenticWorkspacePhase, initialWorkspaceView, nextAgenticWorkspacePhase, parseAgenticWorkspacePhase, parseWorkspaceView, type WorkspaceViewPreference } from './workspace-view'

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

  it('restores a persisted agentic phase and keeps review selected when a run opens its checkpoint', () => {
    expect(parseAgenticWorkspacePhase('review')).toBe('review')
    expect(initialAgenticWorkspacePhase('review')).toBe('review')
    expect(initialAgenticWorkspacePhase('unknown')).toBe('preparation')
    expect(nextAgenticWorkspacePhase('review', 'dashboard')).toBe('review')
    expect(nextAgenticWorkspacePhase('preparation', 'dashboard')).toBe('dashboard')
  })
})
