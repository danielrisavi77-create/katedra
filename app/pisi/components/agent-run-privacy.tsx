'use client'
import { useState } from 'react'

export function AgentRunPrivacy({ runId, projectId, onRevoked }: { runId: string; projectId: string; onRevoked: () => void }) {
  const [busy, setBusy] = useState(false)
  const [cleanup, setCleanup] = useState<'pending' | 'deleted' | null>(null)
  const [message, setMessage] = useState('')
  async function withdraw() {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch(`/api/agent-runs/${encodeURIComponent(runId)}?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' })
      const body = await response.json()
      if (!response.ok || body.consentRevoked !== true || !['deleted', 'pending'].includes(body.cleanup)) throw new Error('Withdrawal failed')
      setCleanup(body.cleanup)
      onRevoked()
      setMessage(body.cleanup === 'deleted'
        ? 'Pristanak je povučen. Privremeni sadržaj je izbrisan.'
        : 'Pristanak je povučen i pristup sadržaju opozvan. Fizičko brisanje čeka ponovni pokušaj.')
    } catch { setMessage('Povlačenje pristanka ili potvrda brisanja nije uspjelo. Pokušaj ponovno.') }
    finally { setBusy(false) }
  }
  return <section aria-label="Privatnost tijeka">
    <p>Povlačenjem pristanka zaustavljaš ovaj tijek i tražiš brisanje njegovih privremenih kopija rukopisa i rezultata. Lokalni rukopis ostaje sačuvan.</p>
    {cleanup !== 'deleted' && <button type="button" disabled={busy} onClick={() => void withdraw()}>{busy ? 'Brisanje…' : cleanup === 'pending' ? 'Ponovi brisanje' : 'Povuci pristanak i izbriši privremeni sadržaj'}</button>}
    {message && <p role="status">{message}</p>}
  </section>
}
