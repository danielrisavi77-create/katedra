'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import '../katedra-scoped.css'

export default function ResetLozinkePage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Lozinka mora imati barem 8 znakova.'); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) { setError(error.message || 'Promjena nije uspjela.'); return }
      setDone(true)
      setTimeout(() => router.push('/'), 1500)
    } catch {
      setError('Promjena trenutno nije dostupna.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="katedra-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="onb-card" style={{ maxWidth: 400 }}>
        <div className="logo-badge" style={{ margin: '0 auto' }}>🔑</div>
        <h2 style={{ margin: '12px 0 4px' }}>Nova lozinka</h2>
        {done ? (
          <p className="onb-sub">Lozinka promijenjena. Preusmjeravam…</p>
        ) : (
          <>
            <p className="onb-sub">Upiši novu lozinku za svoj račun.</p>
            <form onSubmit={submit} style={{ textAlign: 'left', marginTop: 16 }}>
              <div className="fld">
                <label>Nova lozinka</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" minLength={8} />
              </div>
              {error && <p style={{ color: 'var(--bad)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
              <button type="submit" className="copy-btn" disabled={loading}>
                {loading ? 'Spremam…' : 'Spremi novu lozinku'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
