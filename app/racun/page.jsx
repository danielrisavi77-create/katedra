'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ThemeToggle } from '../theme-toggle'
import { createWithdrawalReference } from '../../lib/security/withdrawal-reference'
import '../katedra-scoped.css'

export default function RacunPage() {
  const [step, setStep] = useState('idle') // idle | confirm | done
  const [reason, setReason] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [referenceId, setReferenceId] = useState('')
  const [account, setAccount] = useState(null)
  const [accountError, setAccountError] = useState('')
  const [deleteStep, setDeleteStep] = useState('idle')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/account')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Račun nije dostupan.')
        if (active) setAccount(data)
      })
      .catch((fetchError) => { if (active) setAccountError(fetchError.message) })
    return () => { active = false }
  }, [])

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      const resp = await fetch('/api/withdrawal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined, referenceId }),
      })
      const data = await resp.json()
      if (!resp.ok) { setError(data.error || 'Zahtjev nije uspio.'); return }
      setResult(data)
      setStep('done')
    } catch {
      setError('Zahtjev trenutno nije dostupan.')
    } finally {
      setLoading(false)
    }
  }

  const requestAccountDeletion = async (event) => {
    event.preventDefault()
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Brisanje računa trenutno nije dostupno.')
      setDeleteStep('done')
    } catch (deleteFetchError) {
      setDeleteError(deleteFetchError.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="katedra-page" style={{ minHeight: '100vh', padding: '40px 16px 90px' }}>
      <div className="wrap" style={{ maxWidth: 640 }}>
        <div className="theme-utility-row"><Link href="/pisi" style={{ color: 'var(--acc)', fontSize: 13 }}>← Natrag na Katedru</Link><ThemeToggle /></div>
        <h1 style={{ marginTop: 16 }}>Moj račun</h1>

        {accountError && <p role="alert" style={{ color: 'var(--bad)', fontSize: 13 }}>{accountError}</p>}
        {account && (
          <section className="panel account-overview" aria-labelledby="account-overview-title">
            <p className="pis-kicker">Projektni račun</p>
            <h2 id="account-overview-title">{account.user.email || 'Tvoj račun'}</h2>
            <div className="account-overview-grid">
              <div><b>{account.projects.length}</b><span>projekata</span></div>
              <div><b>{account.passes.filter((pass) => pass.status === 'active').length}</b><span>aktivnih Passova</span></div>
              <div><b>{account.projects.filter((project) => project.lekta_score !== null).length}</b><span>Lekta provjera</span></div>
              <div><b>{account.usage?.requests || 0}</b><span>AI zahtjeva</span></div>
            </div>
            {account.usage && <p className="account-usage-note">AI potrošnja: {account.usage.inputTokens.toLocaleString('hr-HR')} ulaznih i {account.usage.outputTokens.toLocaleString('hr-HR')} izlaznih tokena. Rukopis i promptovi nisu dio account izvoza.</p>}
            {account.projects.length > 0 && <ul className="account-project-list">{account.projects.map((project) => <li key={project.project_id}><div><b>{project.topic || 'Rad bez naslova'}</b><small>{project.work_type_canonical || project.work_type || 'Projekt'} · {project.deadline || 'Bez roka'}</small></div><Link href={`/pisi?projectId=${encodeURIComponent(project.project_id)}`}>Otvori</Link></li>)}</ul>}
            <div className="account-data-actions"><a href="/api/account/export" download>Izvezi podatke</a><span>Rukopis ostaje lokalno na uređaju.</span></div>
          </section>
        )}

        <section className="panel account-privacy" aria-labelledby="account-privacy-title">
          <p className="pis-kicker">Privatnost i podaci</p>
          <h2 id="account-privacy-title">Ti odlučuješ što ostaje.</h2>
          <p>Rukopis i lokalne verzije ostaju na ovom uređaju. Server može izvesti samo projektne metapodatke i sažetak potrošnje.</p>
          <p><Link href="/privatnost">Pročitaj pravila privatnosti</Link></p>
          {account ? (
            <>
              {deleteStep === 'idle' && <button type="button" className="copy-btn" onClick={() => setDeleteStep('confirm')}>Zatraži brisanje računa</button>}
              {deleteStep === 'confirm' && (
                <form onSubmit={requestAccountDeletion} className="account-delete-form">
                  <label htmlFor="account-delete-confirmation">Upiši OBRIŠI RAČUN za potvrdu</label>
                  <input id="account-delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" />
                  {deleteError && <p role="alert">{deleteError}</p>}
                  <div><button type="submit" className="copy-btn" disabled={deleteLoading || deleteConfirmation !== 'OBRIŠI RAČUN'}>{deleteLoading ? 'Šaljem…' : 'Potvrdi zahtjev'}</button><button type="button" className="onb-back" onClick={() => { setDeleteStep('idle'); setDeleteConfirmation(''); setDeleteError('') }} disabled={deleteLoading}>Odustani</button></div>
                </form>
              )}
              {deleteStep === 'done' && <p role="status">Zahtjev za brisanje je zaprimljen.</p>}
            </>
          ) : (
            <div className="account-auth-prompt">
              <p>Za upravljanje računom, izvoz podataka ili zakonske zahtjeve prvo se prijavi.</p>
              <Link href="/prijava?redirect=/racun" className="copy-btn">Prijavi se za upravljanje računom</Link>
            </div>
          )}
        </section>

        {account && <div className="panel" style={{ marginTop: 20, lineHeight: 1.6 }} aria-labelledby="withdrawal-title">
          <h3 id="withdrawal-title">Jednostrani raskid ugovora</h3>
          <p style={{ color: 'var(--mut)' }}>
            Imaš pravo, bez navođenja razloga, jednostrano raskinuti ugovor u roku od 14 dana od
            kupnje (ili ranije ako si pri kupnji potvrdio/la gubitak tog prava zbog trenutnog
            početka usluge — v. <Link href="/uvjeti" style={{ color: 'var(--acc)' }}>Uvjete
            korištenja §5</Link>). Klikom ispod šalješ zahtjev — automatski dobivaš potvrdu na
            e-mail s vremenom primitka.
          </p>

          {step === 'idle' && (
            <button type="button" className="copy-btn" onClick={() => { setReferenceId(createWithdrawalReference()); setStep('confirm') }}>
              Jednostrani raskid ugovora
            </button>
          )}

          {step === 'confirm' && (
            <form style={{ marginTop: 12 }} onSubmit={(event) => { event.preventDefault(); void submit() }}>
              <label htmlFor="withdrawal-reason" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
                Razlog (neobavezno — ne moraš ga navesti)
              </label>
              <textarea
                id="withdrawal-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                style={{ width: '100%', marginBottom: 12, fontFamily: 'inherit' }}
              />
              {error && <p role="alert" aria-live="assertive" style={{ color: 'var(--bad)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="copy-btn" disabled={loading} aria-busy={loading}>
                  {loading ? 'Šaljem…' : 'Da, raskini ugovor'}
                </button>
                <button type="button" className="onb-back" onClick={() => { setReferenceId(''); setStep('idle') }} disabled={loading}>Odustani</button>
              </div>
            </form>
          )}

          {step === 'done' && result && (
            <div style={{ marginTop: 12 }} role="status" aria-live="polite">
              <p style={{ color: 'var(--ok)', fontWeight: 700 }}>✅ Zahtjev zaprimljen.</p>
              <p style={{ color: 'var(--mut)' }}>
                Vrijeme primitka: {new Date(result.requestedAt).toLocaleString('hr-HR')}<br />
                Broj zahtjeva: {result.requestId}<br />
                {result.emailSent
                  ? 'Potvrda je poslana na tvoj e-mail.'
                  : 'Napomena: automatska e-mail potvrda trenutno nije dostupna — spremi ovu stranicu ili broj zahtjeva kao dokaz primitka.'}
              </p>
            </div>
          )}
        </div>}
      </div>
    </div>
  )
}
