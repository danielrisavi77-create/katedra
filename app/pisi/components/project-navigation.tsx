'use client'

import type { ProjectMode } from '../../../lib/manuscript/project-mode'

export type ProjectNavItem =
  | 'home'
  | 'plan'
  | 'sources'
  | 'studio'
  | 'writing'
  | 'mentor'
  | 'review'
  | 'lekta'
  | 'defense'
  | 'history'

const BASE_ITEMS: Array<[ProjectNavItem, string]> = [
  ['home', 'Početna'],
  ['plan', 'Plan'],
  ['sources', 'Literatura'],
  ['studio', 'Radionica'],
  ['writing', 'Pisanje'],
  ['mentor', 'Mentor'],
  ['review', 'Revizija'],
  ['lekta', 'Provjera u Lekti'],
  ['history', 'Povijest'],
]

export function ProjectNavigation({ activeItem, workType, projectMode, onNavigate }: {
  activeItem: ProjectNavItem
  workType: 's' | 'z' | 'd'
  projectMode?: ProjectMode | null
  onNavigate: (item: ProjectNavItem) => void
}) {
  const baseItems = projectMode === 'manual' ? BASE_ITEMS.filter(([item]) => !['studio', 'review'].includes(item)) : BASE_ITEMS
  const items = workType === 's'
    ? baseItems
    : [...baseItems.slice(0, 7), ['defense', 'Obrana'] as [ProjectNavItem, string], ...baseItems.slice(7)]

  return (
    <nav className="pis-project-nav" aria-label="Projekt">
      <div className="pis-project-nav-list">
        {items.map(([item, label]) => (
          <button key={item} type="button" aria-current={activeItem === item ? 'page' : undefined} onClick={() => onNavigate(item)}>
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}
