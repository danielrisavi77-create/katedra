'use client'

import { useState } from 'react'
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

  return (
    <div className="katedra-page" style={{ minHeight: '100vh', padding: '40px 16px 90px' }}>
      <div className="wrap" style={{ maxWidth: 640 }}>
        <div className="theme-utility-row"><Link href="/pisi" style={{ color: 'var(--acc)', fontSize: 13 }}>← Natrag na Katedru</Link><ThemeToggle /></div>
        <h1 style={{ marginTop: 16 }}>Moj račun</h1>

        <div className="panel" style={{ marginTop: 20, lineHeight: 1.6 }} aria-labelledby="withdrawal-title">
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
        </div>
      </div>
    </div>
  )
}
