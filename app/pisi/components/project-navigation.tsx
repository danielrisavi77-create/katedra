'use client'

export type ProjectNavItem =
  | 'home'
  | 'plan'
  | 'sources'
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
  ['writing', 'Pisanje'],
  ['mentor', 'Mentor'],
  ['review', 'Revizija'],
  ['lekta', 'Provjera u Lekti'],
  ['history', 'Povijest'],
]

export function ProjectNavigation({ activeItem, workType, onNavigate }: {
  activeItem: ProjectNavItem
  workType: 's' | 'z' | 'd'
  onNavigate: (item: ProjectNavItem) => void
}) {
  const items = workType === 's'
    ? BASE_ITEMS
    : [...BASE_ITEMS.slice(0, 7), ['defense', 'Obrana'] as [ProjectNavItem, string], ...BASE_ITEMS.slice(7)]

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
