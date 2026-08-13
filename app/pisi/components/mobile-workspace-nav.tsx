'use client'

import type { MobileView } from './workspace-shell'

const MOBILE_VIEWS: Array<[MobileView, string, string]> = [
  ['outline', 'Sadržaj', '≡'],
  ['editor', 'Rukopis', '✎'],
  ['assistant', 'Katedra', 'K'],
]

export type MobileWorkspaceNavProps = {
  activeMobileView: MobileView
  onMobileViewChange: (view: MobileView) => void
}

export function MobileWorkspaceNav({ activeMobileView, onMobileViewChange }: MobileWorkspaceNavProps) {
  return (
    <nav className="pis-mobile-nav" aria-label="Radni prostor">
      {MOBILE_VIEWS.map(([view, label, icon]) => (
        <button
          key={view}
          type="button"
          className={activeMobileView === view ? 'is-active' : ''}
          aria-current={activeMobileView === view ? 'page' : undefined}
          onClick={() => onMobileViewChange(view)}
        >
          <span className="pis-mobile-nav-icon" aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
