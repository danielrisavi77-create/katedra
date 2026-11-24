'use client'

import { useEffect, useState } from 'react'

import LegalSummaryModal from '../../legal-summary-modal'
import type { LegacyWorkType } from '../../../lib/manuscript/types'
import type { AcademicContext } from '../../../lib/academic-context/types'
import { academicVisibilityForStatus } from '../../../lib/academic-context/visibility'
import { KATEDRA_PACKAGES } from '../../../lib/stripe/catalog'
import { productPromiseForWorkType } from '../../../lib/product/promise-contract'
import { passModulesForWorkType } from '../../../lib/product/v1-modules'
import { FocusTrap } from './focus-trap'

const PASS_PACKAGES: Record<LegacyWorkType, { key: string; name: string; price: string }> = {
  s: { key: 'seminarski', name: KATEDRA_PACKAGES.seminarski.name, price: formatPrice(KATEDRA_PACKAGES.seminarski.eur) },
  z: { key: 'zavrsni', name: KATEDRA_PACKAGES.zavrsni.name, price: formatPrice(KATEDRA_PACKAGES.zavrsni.eur) },
  d: { key: 'diplomski', name: KATEDRA_PACKAGES.diplomski.name, price: formatPrice(KATEDRA_PACKAGES.diplomski.eur) },
}

export function PassDialog({
  open,
  projectId,
  workType,
  projectTitle = 'Rad bez naslova',
  institution,
  program,
  profileId,
  mentor,
  deadline,
  academicContext,
  onClose,
  onOpen,
  onCheckoutStarted,
  onRedirect = (url) => window.location.assign(url),
}: {
  open: boolean
  projectId: string
  workType: LegacyWorkType
  projectTitle?: string
  institution?: string
  program?: string
  profileId?: string
  mentor?: string
  deadline?: string
  academicContext?: AcademicContext | null
  onClose: () => void
  onOpen?: () => void
  onCheckoutStarted?: () => void
  onRedirect?: (url: string) => void
}) {
  const [consent, setConsent] = useState(false)
  const [lockConsent, setLockConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pkg = PASS_PACKAGES[workType]
  const promise = productPromiseForWorkType(pkg.key)
  const academicVisibility = academicContext ? academicVisibilityForStatus(academicContext.status) : null
  const canPurchasePass = Boolean(academicContext && academicContext.status === 'verified' && academicVisibility?.canPurchasePass === true)

  useEffect(() => { if (open) onOpen?.() }, [onOpen, open])

  if (!open) return null

  const checkout = async () => {
    if (!consent || !lockConsent || busy || !canPurchasePass) return
    setBusy(true)
    onCheckoutStarted?.()
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
        <h2 id="pis-pass-title">{pkg.name} za ovaj projekt</h2>
        <div className="pis-pass-product">
          <div><b>{pkg.name}</b><span>za ovaj konkretan akademski projekt</span></div>
          <strong>{pkg.price}</strong>
        </div>
        <p id="pis-pass-description" className="pis-pass-copy">Pass otključava Katedrina uređivanja za ovaj rukopis. Uobičajeno pisanje i lokalne verzije ostaju na ovom uređaju. Ako pokreneš agentički tijek, prije prvog pokretanja zasebno potvrđuješ privremeni prijenos snapshot-a rukopisa i odabranih materijala u privatnu pohranu, najviše 72 sata. Stripe obrađuje plaćanje.</p>
        <ul className="pis-pass-includes" aria-label="Uključeno u Pass">{passModulesForWorkType(workType).filter((module) => promise.modules.some((id) => id === module.id)).map((module) => <li key={module.id}><b>{module.label}</b><small>{module.actionLabel} · {module.surface}</small></li>)}</ul>
        <div className="pis-pass-summary" aria-label="Sažetak projekta">
          <div><span>Projekt</span><b>{projectTitle}</b></div>
          <div><span>Fakultet / smjer</span><b>{[institution, program].filter(Boolean).join(' · ') || 'Nije uneseno'}</b></div>
          <div><span>Mentor / rok</span><b>{[mentor, deadline].filter(Boolean).join(' · ') || 'Nije uneseno'}</b></div>
        </div>
        {academicContext && academicVisibility && (
          <div className="pis-pass-academic-context" role="status">
            <strong>{academicVisibility.label}</strong>
            <span>{academicContext.profileLabel}</span>
            <small>{academicContext.verifiedAt ? `Provjereno ${academicContext.verifiedAt}.` : 'Datum provjere nije naveden.'}</small>
            {academicContext.sources[0] && <a href={academicContext.sources[0].url} target="_blank" rel="noreferrer">Službeni izvor pravila ↗</a>}
          </div>
        )}
        {!canPurchasePass && <p className="pis-pass-error" role={academicContext ? 'alert' : 'status'}>{academicContext ? 'Ovaj profil trenutno nije moguće kupiti Pass. Nastavi u općem akademskom načinu rada ili odaberi profil s verificiranim pravilima.' : 'Pass je dostupan tek nakon povezivanja verificiranog akademskog profila.'}</p>}
        <div className="pis-pass-warning" role="note">
          <strong>VAŽNO</strong>
          <p>Ovaj Pass vrijedi samo za ovaj projekt i potvrđenu temu. Tema se nakon naplate ne može promijeniti. Za drugi rad potreban je novi projekt i novi Pass.</p>
          <p>Tema ovog projekta bit će zaključana nakon naplate.</p>
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
        <button type="button" className="pis-pass-submit" disabled={!consent || !lockConsent || busy || !canPurchasePass} onClick={() => void checkout()}>
          {busy ? 'Otvaram Stripe…' : 'Nastavi na sigurno plaćanje'}
        </button>
        <small className="pis-pass-footnote">Jednokratno plaćanje. Katedra ne vidi podatke tvoje kartice.</small>
      </div>
      </FocusTrap>
    </div>
  )
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(value)
}
