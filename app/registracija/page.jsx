'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import '../katedra-scoped.css'

export default function RegistracijaPage() {
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
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) { setError(error.message || 'Registracija nije uspjela.'); return }

      // Supabase intentionally obscures whether a confirmed account already exists:
      // repeated signup can return HTTP 200 with a user object but no identities/session.
      // Do not tell the user to wait for a confirmation email that will never be sent.
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError('Račun s ovom e-mail adresom već postoji. Prijavi se ili zatraži novu lozinku.')
        return
      }

      if (data.session) { window.location.href = '/pisi'; return }
      setDone(true)
    } catch {
      setError('Registracija trenutno nije dostupna.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="katedra-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="onb-card" style={{ maxWidth: 400 }}>
          <div className="logo-badge" style={{ margin: '0 auto' }}>✉️</div>
          <h2 style={{ margin: '12px 0 4px' }}>Provjeri e-mail</h2>
          <p className="onb-sub">Poslali smo ti link za potvrdu na <b>{email}</b>. Klikni ga da dovršiš registraciju.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="katedra-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="onb-card" style={{ maxWidth: 400 }}>
        <div className="logo-badge" style={{ margin: '0 auto' }}>K</div>
        <h2 style={{ margin: '12px 0 4px' }}>Registracija</h2>
        <p className="onb-sub">Napravi Katedra račun.</p>
        <form onSubmit={submit} style={{ textAlign: 'left', marginTop: 16 }}>
          <div className="fld">
            <label>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="fld">
            <label>Lozinka</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" minLength={8} />
            <div className="hint">Barem 8 znakova.</div>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--mut)', marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2, flex: 'none' }} />
            <span>
              Slažem se s{' '}
              <Link href="/uvjeti" target="_blank" style={{ color: 'var(--acc)' }}>Uvjetima korištenja</Link>{' '}
              i{' '}
              <Link href="/privatnost" target="_blank" style={{ color: 'var(--acc)' }}>Politikom privatnosti</Link>.
            </span>
          </label>
          {error && <p style={{ color: 'var(--bad)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
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
    </div>
  )
}
