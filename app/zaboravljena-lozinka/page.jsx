'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ThemeToggle } from '../theme-toggle'
import '../katedra-scoped.css'

function formatRetryTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString('hr-HR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export default function ZaboravljenaLozinkaPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [retryAt, setRetryAt] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setRetryAt('')
    setLoading(true)
    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error || 'Slanje trenutno nije dostupno.')
        setRetryAt(typeof body.retryAt === 'string' ? body.retryAt : '')
        return
      }
      setDone(true)
    } catch {
      setError('Slanje trenutno nije dostupno.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="katedra-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="theme-page-control"><ThemeToggle /></div>
        <div className="onb-card" style={{ maxWidth: 400 }}>
          <div className="logo-badge" style={{ margin: '0 auto' }}>✉️</div>
          <h2 style={{ margin: '12px 0 4px' }}>Provjeri e-mail</h2>
          <p className="onb-sub">Ako postoji račun za <b>{email}</b>, poslali smo link za reset lozinke.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="katedra-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="theme-page-control"><ThemeToggle /></div>
      <div className="onb-card" style={{ maxWidth: 400 }}>
        <div className="logo-badge" style={{ margin: '0 auto' }}>🔑</div>
        <h2 style={{ margin: '12px 0 4px' }}>Zaboravljena lozinka</h2>
        <p className="onb-sub">Upiši e-mail — poslat ćemo ti link za reset.</p>
        <form onSubmit={submit} style={{ textAlign: 'left', marginTop: 16 }}>
          <div className="fld">
            <label htmlFor="forgot-email">E-mail</label>
            <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          {error && (
            <p role="alert" aria-live="assertive" style={{ color: 'var(--bad)', fontSize: 13, marginBottom: 10 }}>
              {error}
              {retryAt && (
                <>
                  <br />
                  <span>Najranije pokušaj ponovno u {formatRetryTime(retryAt)} (po lokalnom vremenu).</span>
                </>
              )}
            </p>
          )}
          <button type="submit" className="copy-btn" disabled={loading}>
            {loading ? 'Šaljem…' : 'Pošalji link'}
          </button>
        </form>
        <p className="onb-note">
          <Link href="/prijava" style={{ color: 'var(--acc)' }}>← Natrag na prijavu</Link>
        </p>
      </div>
    </div>
  )
}
