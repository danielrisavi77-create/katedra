'use client'

import { useState } from 'react'

import LegalSummaryModal from '../../legal-summary-modal'
import type { LegacyWorkType } from '../../../lib/manuscript/types'
import { FocusTrap } from './focus-trap'

const PASS_PACKAGES: Record<LegacyWorkType, { key: string; name: string; price: string }> = {
  s: { key: 'seminarski', name: 'Seminarski Pass', price: '29,90 €' },
  z: { key: 'zavrsni', name: 'Završni Pass', price: '79,90 €' },
  d: { key: 'diplomski', name: 'Diplomski Pass', price: '129,90 €' },
}

const PASS_INCLUDES: Record<LegacyWorkType, string[]> = {
  s: ['struktura i izvori', 'pisanje po sekcijama', 'revizija i Lekta handoff'],
  z: ['istraživačko pitanje i metodologija', 'pisanje i mentor review', 'priprema obrane i Lekta handoff'],
  d: ['istraživački dizajn i podatci', 'više revizijskih krugova', 'simulator obrane i Lekta handoff'],
}

export function PassDialog({
  open,
  projectId,
  workType,
  projectTitle = 'Rad bez naslova',
  institution,
  program,
  mentor,
  deadline,
  onClose,
  onRedirect = (url) => window.location.assign(url),
}: {
  open: boolean
  projectId: string
  workType: LegacyWorkType
  projectTitle?: string
  institution?: string
  program?: string
  mentor?: string
  deadline?: string
  onClose: () => void
  onRedirect?: (url: string) => void
}) {
  const [consent, setConsent] = useState(false)
  const [lockConsent, setLockConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pkg = PASS_PACKAGES[workType]

  if (!open) return null

  const checkout = async () => {
    if (!consent || !lockConsent || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ package: pkg.key, projectId, topic: projectTitle, lockConfirmation: true }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || typeof body.url !== 'string') throw new Error(body.error || 'Plaćanje trenutačno nije dostupno.')
      onRedirect(body.url)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Plaćanje trenutačno nije dostupno.')
      setBusy(false)
    }
  }

  return (
    <div className="pis-pass-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <FocusTrap onEscape={() => { if (!busy) onClose() }}>
      <div className="pis-pass-dialog" role="dialog" aria-modal="true" aria-labelledby="pis-pass-title" aria-describedby="pis-pass-description" tabIndex={-1}>
        <button type="button" className="pis-pass-close" aria-label="Zatvori" onClick={onClose} disabled={busy}>×</button>
        <p className="pis-kicker">Project Pass</p>
        <h2 id="pis-pass-title">Nastavi raditi bez prekida.</h2>
        <div className="pis-pass-product">
          <div><b>{pkg.name}</b><span>za ovaj konkretan akademski projekt</span></div>
          <strong>{pkg.price}</strong>
        </div>
        <p id="pis-pass-description" className="pis-pass-copy">Pass otključava Katedrina uređivanja za ovaj rukopis. Tekst rada ostaje lokalno na ovom uređaju; Stripe obrađuje plaćanje.</p>
        <ul className="pis-pass-includes" aria-label="Uključeno u Pass">{PASS_INCLUDES[workType].map((item) => <li key={item}>{item}</li>)}</ul>
        <div className="pis-pass-summary" aria-label="Sažetak projekta">
          <div><span>Projekt</span><b>{projectTitle}</b></div>
          <div><span>Fakultet / smjer</span><b>{[institution, program].filter(Boolean).join(' · ') || 'Nije uneseno'}</b></div>
          <div><span>Mentor / rok</span><b>{[mentor, deadline].filter(Boolean).join(' · ') || 'Nije uneseno'}</b></div>
        </div>
        <div className="pis-pass-warning" role="note">
          <strong>VAŽNO</strong>
          <p>Ovaj Pass vrijedi samo za ovaj projekt i potvrđenu temu. Tema se nakon naplate ne može promijeniti. Za drugi rad potreban je novi projekt i novi Pass.</p>
        </div>
        <label className="pis-pass-consent">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>Prihvaćam <LegalSummaryModal type="uvjeti" triggerLabel="Uvjete korištenja" /> i <LegalSummaryModal type="privatnost" triggerLabel="Politiku privatnosti" /> te tražim da usluga počne odmah.</span>
        </label>
        <label className="pis-pass-consent pis-pass-lock-consent">
          <input type="checkbox" checked={lockConsent} onChange={(event) => setLockConsent(event.target.checked)} />
          <span>Potvrđujem da su podaci točni i razumijem da se nakon naplate tema ne može promijeniti.</span>
        </label>
        {error && <p className="pis-pass-error" role="alert">{error}</p>}
        <button type="button" className="pis-pass-submit" disabled={!consent || !lockConsent || busy} onClick={() => void checkout()}>
          {busy ? 'Otvaram Stripe…' : 'Nastavi na sigurno plaćanje'}
        </button>
        <small className="pis-pass-footnote">Jednokratno plaćanje. Katedra ne vidi podatke tvoje kartice.</small>
      </div>
      </FocusTrap>
    </div>
  )
}
