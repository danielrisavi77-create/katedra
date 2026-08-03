'use client'

import { useState } from 'react'
import Link from 'next/link'
import '../katedra-scoped.css'

export default function RacunPage() {
  const [step, setStep] = useState('idle') // idle | confirm | done
  const [reason, setReason] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      const resp = await fetch('/api/withdrawal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
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
        <Link href="/" style={{ color: 'var(--acc)', fontSize: 13 }}>← Natrag na Katedru</Link>
        <h1 style={{ marginTop: 16 }}>Moj račun</h1>

        <div className="panel" style={{ marginTop: 20, lineHeight: 1.6 }}>
          <h3>Jednostrani raskid ugovora</h3>
          <p style={{ color: 'var(--mut)' }}>
            Imaš pravo, bez navođenja razloga, jednostrano raskinuti ugovor u roku od 14 dana od
            kupnje (ili ranije ako si pri kupnji potvrdio/la gubitak tog prava zbog trenutnog
            početka usluge — v. <Link href="/uvjeti" style={{ color: 'var(--acc)' }}>Uvjete
            korištenja §5</Link>). Klikom ispod šalješ zahtjev — automatski dobivaš potvrdu na
            e-mail s vremenom primitka.
          </p>

          {step === 'idle' && (
            <button className="copy-btn" onClick={() => setStep('confirm')}>
              Jednostrani raskid ugovora
            </button>
          )}

          {step === 'confirm' && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
                Razlog (neobavezno — ne moraš ga navesti)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                style={{ width: '100%', marginBottom: 12, fontFamily: 'inherit' }}
              />
              {error && <p style={{ color: 'var(--bad)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="copy-btn" onClick={submit} disabled={loading}>
                  {loading ? 'Šaljem…' : 'Da, raskini ugovor'}
                </button>
                <button className="onb-back" onClick={() => setStep('idle')} disabled={loading}>Odustani</button>
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div style={{ marginTop: 12 }}>
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
