'use client'

import type { CompletionScan } from '../../../lib/project/completion-scan'
import { buildProjectAuthRedirect } from '../../../lib/auth/project-redirect'

export function FreeProjectPlan({ projectId, title, scan, authenticated = false, onContinue }: { projectId: string; title: string; scan: CompletionScan; authenticated?: boolean; onContinue: () => void }) {
  const registrationRedirect = buildProjectAuthRedirect(projectId)
  return (
    <main className="pis-onboarding pis-free-plan" aria-labelledby="free-plan-title">
      <section className="pis-onboarding-step">
        <p className="pis-kicker">Completion Scan</p>
        <h1 id="free-plan-title">Znaš gdje si. Evo što slijedi.</h1>
        <p className="pis-onboarding-lead">{title ? `Za rad „${title}“` : 'Za tvoj projekt'} izdvojili smo ono što već imaš i tri najkorisnija sljedeća koraka.</p>

        {scan.strengths.length > 0 && (
          <section className="pis-scan-section" aria-labelledby="scan-strengths-title">
            <h2 id="scan-strengths-title">Već imaš</h2>
            <ul>{scan.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        )}

        {scan.missing.length > 0 && (
          <section className="pis-scan-section" aria-labelledby="scan-missing-title">
            <h2 id="scan-missing-title">Nedostaje</h2>
            <ul>{scan.missing.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        )}

        <section className="pis-scan-section" aria-labelledby="scan-next-title">
          <h2 id="scan-next-title">Sljedeća tri koraka</h2>
          <ol>{scan.nextActions.map((item) => <li key={item}>{item}</li>)}</ol>
        </section>

        <p className="pis-catalog-note">Ovo je besplatni projektni plan. Katedra ne generira puni rad bez aktivnog opsega i korisničke odluke.</p>
        <div className="pis-onboarding-actions">
          {!authenticated && <a className="pis-text-button" href={`/registracija?redirect=${encodeURIComponent(registrationRedirect)}`}>Spremi plan na račun</a>}
          <button type="button" className="pis-primary-button" data-primary-action="true" onClick={onContinue}>Nastavi u projektu →</button>
        </div>
      </section>
    </main>
  )
}
