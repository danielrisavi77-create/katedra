'use client'

import type { NextAction } from '../../../lib/project/next-action'

export function NextActionCard({ action, onNavigate }: { action: NextAction; onNavigate: (destination: NextAction['destination']) => void }) {
  return (
    <section className="pis-next-action-card" aria-labelledby="next-action-title">
      <p className="pis-kicker">Tvoj sljedeći korak</p>
      <h2 id="next-action-title">{action.title}</h2>
      <p>{action.detail}</p>
      <button type="button" className="pis-primary-button" data-primary-action="true" onClick={() => onNavigate(action.destination)}>{action.cta}</button>
    </section>
  )
}
