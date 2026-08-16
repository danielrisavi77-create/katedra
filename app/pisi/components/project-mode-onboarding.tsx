'use client'

import { useState } from 'react'

import type { ProjectMode } from '../../../lib/manuscript/project-mode'

export function ProjectModeOnboarding({ onComplete, autonomousAvailable = true }: { onComplete: (mode: ProjectMode) => void; autonomousAvailable?: boolean }) {
  const [selectedMode, setSelectedMode] = useState<ProjectMode | null>(null)

  return (
    <section className="pis-mode-onboarding" aria-labelledby="pis-mode-onboarding-title">
      <header className="pis-mode-onboarding-header">
        <p className="pis-kicker">Pass aktivan za ovaj projekt</p>
        <h1 id="pis-mode-onboarding-title">Kako želiš izraditi ovaj rad?</h1>
        <p>Ovaj izbor određuje tvoje cijelo radno sučelje. Odaberi način rada prije nego što pokrenemo projekt.</p>
      </header>

      <div className="pis-mode-options">
        <button type="button" className={selectedMode === 'manual' ? 'is-selected' : ''} aria-pressed={selectedMode === 'manual'} onClick={() => setSelectedMode('manual')}>
          <span>01</span>
          <strong>Radionica rukopisa</strong>
          <small>Ti pišeš, a Katedra pomaže s argumentima, izvorima, mentorovim komentarima i revizijama.</small>
          <em aria-hidden="true">→</em>
        </button>
        <button type="button" className={selectedMode === 'autonomous' ? 'is-selected' : ''} aria-pressed={selectedMode === 'autonomous'} disabled={!autonomousAvailable} onClick={() => autonomousAvailable && setSelectedMode('autonomous')}>
          <span>02</span>
          <strong>Autonomna izrada</strong>
          <small>{autonomousAvailable ? 'Katedra samostalno prolazi kroz materijale, literaturu, strukturu, pisanje i provjeru rada.' : 'Bit će dostupna kada se aktiviraju sigurni server-side agent ugovori.'}</small>
          <em aria-hidden="true">→</em>
        </button>
      </div>

      <footer className="pis-mode-onboarding-footer">
        <p>Način rada vrijedi za ovaj projekt. Nakon pokretanja prve generacije više se ne mijenja.</p>
        <button type="button" className="is-primary" disabled={!selectedMode} onClick={() => selectedMode && onComplete(selectedMode)}>
          {selectedMode === 'autonomous' ? 'Pokreni autonomni workspace' : selectedMode === 'manual' ? 'Nastavi u radionicu' : 'Nastavi'}
        </button>
      </footer>
    </section>
  )
}
