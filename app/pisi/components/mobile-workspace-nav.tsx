'use client'

import { normalizeMobileView, type MobileView } from './workspace-shell'

const MOBILE_VIEWS: Array<[MobileView, string, string]> = [
  ['overview', 'Pregled', '≡'],
  ['editor', 'Rukopis', '✎'],
  ['assistant', 'Katedra', 'K'],
]

export type MobileWorkspaceNavProps = {
  activeMobileView: MobileView
  onMobileViewChange: (view: MobileView) => void
}

export function MobileWorkspaceNav({ activeMobileView, onMobileViewChange }: MobileWorkspaceNavProps) {
  const normalizedView = normalizeMobileView(activeMobileView)

  return (
    <nav className="pis-mobile-nav" aria-label="Radni prostor">
      {MOBILE_VIEWS.map(([view, label, icon]) => (
        <button
          key={view}
          type="button"
          className={normalizedView === view ? 'is-active' : ''}
          aria-current={normalizedView === view ? 'page' : undefined}
          onClick={() => onMobileViewChange(view)}
        >
          <span className="pis-mobile-nav-icon" aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
