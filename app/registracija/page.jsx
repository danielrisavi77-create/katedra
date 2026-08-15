'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSafeInternalRedirect } from '@/lib/auth/redirect'
import { buildProjectAuthRedirect } from '@/lib/auth/project-redirect'
import LegalSummaryModal from '../legal-summary-modal'
import { ThemeToggle } from '../theme-toggle'
import '../katedra-scoped.css'

function resolveRegistrationRedirect() {
  if (typeof window === 'undefined') return '/pisi'
  const params = new URLSearchParams(window.location.search)
  if (params.get('redirect')) return getSafeInternalRedirect(params.get('redirect'))

  try {
    const manifest = JSON.parse(window.localStorage.getItem('rp_manifest') || 'null')
    const projectId = typeof manifest?.projectId === 'string' ? manifest.projectId.trim() : ''
    return projectId ? buildProjectAuthRedirect(projectId) : '/pisi'
  } catch {
    return '/pisi'
  }
}

export default function RegistracijaPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Lozinka mora imati barem 8 znakova.'); return }
    if (!agree) { setError('Za registraciju moraš prihvatiti Uvjete korištenja i Politiku privatnosti.'); return }
    setLoading(true)
    try {
      const authRedirect = resolveRegistrationRedirect()
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(authRedirect)}` },
      })
      if (error) { setError(error.message || 'Registracija nije uspjela.'); return }

      // Supabase intentionally obscures whether a confirmed account already exists:
      // repeated signup can return HTTP 200 with a user object but no identities/session.
      // Do not tell the user to wait for a confirmation email that will never be sent.
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError('Račun s ovom e-mail adresom već postoji. Prijavi se ili zatraži novu lozinku.')
        return
      }

      if (data.session) { router.push(authRedirect); return }
      setDone(true)
    } catch {
      setError('Registracija trenutno nije dostupna.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <main className="katedra-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="theme-page-control"><ThemeToggle /></div>
        <div className="onb-card" style={{ maxWidth: 400 }}>
          <div className="logo-badge" style={{ margin: '0 auto' }}>✉️</div>
          <h1 style={{ margin: '12px 0 4px' }}>Provjeri e-mail</h1>
          <p className="onb-sub">Poslali smo ti link za potvrdu na <b>{email}</b>. Klikni ga da dovršiš registraciju.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="katedra-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="theme-page-control"><ThemeToggle /></div>
      <div className="onb-card" style={{ maxWidth: 400 }}>
        <div className="logo-badge" style={{ margin: '0 auto' }}>K</div>
        <h1 style={{ margin: '12px 0 4px' }}>Registracija</h1>
        <p className="onb-sub">Napravi Katedra račun i nastavi raditi na istom projektu.</p>
        <p className="onb-project-note">Ako već dolaziš iz rada, nastavljaš isti projekt: njegov projectId ostaje isti nakon registracije i potvrde e-maila.</p>
        <form onSubmit={submit} style={{ textAlign: 'left', marginTop: 16 }}>
          <div className="fld">
            <label htmlFor="registration-email">E-mail</label>
            <input id="registration-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="fld">
            <label htmlFor="registration-password">Lozinka</label>
            <input id="registration-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" minLength={8} />
            <div className="hint">Barem 8 znakova.</div>
          </div>
          <div className="legal-consent">
            <input id="registrationConsent" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              <label htmlFor="registrationConsent">Slažem se s</label>{' '}
              <LegalSummaryModal type="uvjeti" />{' '}
              i{' '}
              <LegalSummaryModal type="privatnost" />.
            </span>
          </div>
          {error && <p role="alert" aria-live="assertive" style={{ color: 'var(--bad)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
          <button type="submit" className="copy-btn" disabled={loading || !agree}>
            {loading ? 'Stvaram račun…' : 'Registriraj se'}
          </button>
        </form>
        <p className="onb-note">
          Već imaš račun? <Link href="/prijava" style={{ color: 'var(--acc)' }}>Prijavi se</Link>
          <br />
          <Link href="/zaboravljena-lozinka" style={{ color: 'var(--acc)' }}>Zaboravljena lozinka?</Link>
        </p>
      </div>
    </main>
  )
}
