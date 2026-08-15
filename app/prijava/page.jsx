'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSafeInternalRedirect } from '@/lib/auth/redirect'
import { buildProjectAuthRedirect } from '@/lib/auth/project-redirect'
import { ThemeToggle } from '../theme-toggle'
import '../katedra-scoped.css'

function PrijavaForm() {
  const router = useRouter()
  const params = useSearchParams()
  const requestedRedirect = getSafeInternalRedirect(params.get('redirect'))
  const [redirect] = useState(() => {
    if (typeof window === 'undefined') return requestedRedirect
    if (params.get('redirect')) return requestedRedirect
    try {
      const manifest = JSON.parse(window.localStorage.getItem('rp_manifest') || 'null')
      const projectId = typeof manifest?.projectId === 'string' ? manifest.projectId.trim() : ''
      return projectId ? buildProjectAuthRedirect(projectId) : requestedRedirect
    } catch {
      return requestedRedirect
    }
  })
  const callbackError = params.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(callbackError ? 'Prijava nije uspjela — pokušaj ponovno.' : '')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError('Neispravna e-mail adresa ili lozinka.'); return }
      router.push(redirect)
    } catch {
      setError('Prijava trenutno nije dostupna.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="katedra-page auth-page" data-skin="kreda">
      <div className="auth-shell">
        <header className="auth-header">
          <Link href="/" className="auth-brand">
            <div className="logo-badge">K</div>
            <div>
              <strong className="auth-brand-title">Katedra</strong>
              <span className="auth-brand-subtitle">Od teme do obrane</span>
            </div>
          </Link>
          <div className="auth-header-actions"><ThemeToggle /><Link href="/" className="auth-header-link">← Početna</Link></div>
        </header>

        <main className="auth-layout">
          <section className="auth-intro">
            <p className="auth-kicker">Dobro došao natrag</p>
            <h1>Vrati se svom radu.</h1>
            <p className="auth-intro-copy">
              Otvori svoj projekt i nastavi tamo gdje si stao. Tvoje faze, bilješke i sljedeći korak čekaju na istom mjestu.
            </p>
            <div className="auth-note">
              <span className="auth-note-mark">K</span>
              <p><b>Jedan rad, jedan tok.</b><br />Katedra čuva fokus na onome što trebaš napraviti dalje.</p>
            </div>
          </section>

          <section className="auth-card">
            <div className="auth-card-head">
              <p className="auth-kicker">Pristup računu</p>
              <h2>Prijava</h2>
              <p>Prijavi se na svoj Katedra račun.</p>
            </div>
            <form onSubmit={submit} className="auth-form">
          <div className="fld">
            <label htmlFor="login-email">E-mail</label>
            <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="fld">
            <label htmlFor="login-password">Lozinka</label>
            <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && <p role="alert" aria-live="assertive" style={{ color: 'var(--bad)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
          <button type="submit" className="copy-btn" disabled={loading}>
            {loading ? 'Prijavljujem…' : 'Prijavi se'}
          </button>
        </form>
            <div className="auth-links">
              <span>Nemaš račun?</span> <Link href="/registracija">Registriraj se</Link>
              <Link href="/zaboravljena-lozinka">Zaboravljena lozinka?</Link>
            </div>
          </section>
        </main>

        <footer className="auth-footer">
          <span>Katedra · od teme do obrane</span>
          <span><Link href="/privatnost">Privatnost</Link> · <Link href="/uvjeti">Uvjeti korištenja</Link></span>
        </footer>
      </div>
    </div>
  )
}

export default function PrijavaPage() {
  return (
    <Suspense fallback={null}>
      <PrijavaForm />
    </Suspense>
  )
}
