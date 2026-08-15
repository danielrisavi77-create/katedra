import { describe, expect, it } from 'vitest'

import { projectNavigationDestination } from './project-navigation-routing'

describe('projectNavigationDestination', () => {
  it('maps every project navigation item to its concrete workspace destination', () => {
    expect(projectNavigationDestination('home')).toEqual({ kind: 'home' })
    expect(projectNavigationDestination('writing')).toEqual({ kind: 'writing' })
    expect(projectNavigationDestination('review')).toEqual({ kind: 'agentic-review' })
    expect(projectNavigationDestination('plan')).toEqual({ kind: 'drawer', tab: 'plan' })
    expect(projectNavigationDestination('sources')).toEqual({ kind: 'drawer', tab: 'sources' })
    expect(projectNavigationDestination('mentor')).toEqual({ kind: 'drawer', tab: 'mentor' })
    expect(projectNavigationDestination('lekta')).toEqual({ kind: 'drawer', tab: 'lekta' })
    expect(projectNavigationDestination('history')).toEqual({ kind: 'drawer', tab: 'history' })
    expect(projectNavigationDestination('defense')).toEqual({ kind: 'drawer', tab: 'defense' })
  })
})
