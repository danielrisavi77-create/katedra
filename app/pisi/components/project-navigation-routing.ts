import type { ProjectNavItem } from './project-navigation'

export type ProjectDrawerTab = 'plan' | 'agents' | 'sources' | 'mentor' | 'rules' | 'lekta' | 'history' | 'defense' | 'help'

export type ProjectNavigationDestination =
  | { kind: 'home' }
  | { kind: 'writing' }
  | { kind: 'agentic'; phase: 'preparation' }
  | { kind: 'agentic-review' }
  | { kind: 'drawer'; tab: ProjectDrawerTab }

export function projectNavigationDestination(item: ProjectNavItem): ProjectNavigationDestination {
  switch (item) {
    case 'home': return { kind: 'home' }
    case 'studio': return { kind: 'agentic', phase: 'preparation' }
    case 'writing': return { kind: 'writing' }
    case 'review': return { kind: 'agentic-review' }
    case 'plan': return { kind: 'drawer', tab: 'plan' }
    case 'sources': return { kind: 'drawer', tab: 'sources' }
    case 'mentor': return { kind: 'drawer', tab: 'mentor' }
    case 'lekta': return { kind: 'drawer', tab: 'lekta' }
    case 'history': return { kind: 'drawer', tab: 'history' }
    case 'defense': return { kind: 'drawer', tab: 'defense' }
  }
}
