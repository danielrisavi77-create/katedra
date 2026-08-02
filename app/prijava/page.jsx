'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import '../katedra-scoped.css'

function PrijavaForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/'
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
    <div className="katedra-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="onb-card" style={{ maxWidth: 400 }}>
        <div className="logo-badge" style={{ margin: '0 auto' }}>K</div>
        <h2 style={{ margin: '12px 0 4px' }}>Prijava</h2>
        <p className="onb-sub">Prijavi se na svoj Katedra račun.</p>
        <form onSubmit={submit} style={{ textAlign: 'left', marginTop: 16 }}>
          <div className="fld">
            <label>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="fld">
            <label>Lozinka</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && <p style={{ color: 'var(--bad)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
          <button type="submit" className="copy-btn" disabled={loading}>
            {loading ? 'Prijavljujem…' : 'Prijavi se'}
          </button>
        </form>
        <p className="onb-note">
          Nemaš račun? <Link href="/registracija" style={{ color: 'var(--acc)' }}>Registriraj se</Link>
          <br />
          <Link href="/zaboravljena-lozinka" style={{ color: 'var(--acc)' }}>Zaboravljena lozinka?</Link>
        </p>
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
