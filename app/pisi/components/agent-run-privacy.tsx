'use client'

import { useState } from 'react'

import type { AgentRunPrivacyStatus as PrivacyStatus } from '../../../lib/agents/privacy-consent'

export function AgentSnapshotConsent({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <section className="pis-agent-privacy-consent" aria-labelledby="pis-agent-privacy-title">
      <p className="pis-kicker">Prije prvog pokretanja</p>
      <h3 id="pis-agent-privacy-title">Kako čuvamo tvoj kontekst</h3>
      <p>Da bi Katedra mogla nastaviti rad nakon zatvaranja preglednika, šaljemo privremeni snapshot rukopisa i odabrane materijale u privatnu pohranu preko zaštićene veze. Čuvamo ih najviše 72 sata; ovo nije end-to-end šifriranje niti mijenja tvoj lokalni canonical rukopis.</p>
      <p>Po završetku, otkazivanju ili blokadi runa sadržaj i manifest brišu se odmah. Ako brisanje privremeno ne uspije, sustav ga ponovno pokušava i jasno prikazuje taj status. Tvoj lokalni rukopis se ovime ne mijenja.</p>
      <label className="pis-agent-privacy-check">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>Razumijem i dopuštam privremeni prijenos konteksta ovog projekta radi agentičkog tijeka.</span>
      </label>
    </section>
  )
}

export type AgentRunPrivacySnapshot = {
  status: PrivacyStatus
  expiresAt?: string
  deletedAt?: string
  cleanupError?: string
}

export function AgentRunPrivacyStatus({ projectId, runId, runStatus, initial }: { projectId: string; runId: string; runStatus?: string; initial?: AgentRunPrivacySnapshot }) {
  const [manualStatus, setManualStatus] = useState<PrivacyStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const terminal = ['completed', 'blocked', 'failed', 'cancelled'].includes(runStatus || '')
  const status = manualStatus || initial?.status || 'temporarily_uploaded'
  const expiresAt = initial?.expiresAt || ''
  const cleanupError = initial?.cleanupError || ''

  const deleteTemporaryData = async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/agent-runs/${encodeURIComponent(runId)}/temporary-data?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' })
      const body = await response.json().catch(() => ({})) as Record<string, unknown>
      if (!response.ok && body.status !== 'deletion_scheduled') throw new Error(typeof body.error === 'string' ? body.error : 'Privremene podatke nije moguće obrisati.')
      setManualStatus(body.status === 'deletion_scheduled' ? 'deletion_scheduled' : 'deleted')
      setMessage(body.status === 'deletion_scheduled' ? 'Brisanje je zakazano za ponovni pokušaj.' : 'Privremeni podaci runa su obrisani.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Brisanje privremenih podataka nije uspjelo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="pis-agent-privacy-status" aria-label="Privatnost agentičkog runa">
      <div>
        <p className="pis-kicker">Privremeni kontekst</p>
        <strong>{privacyStatusLabel(status)}</strong>
        {expiresAt && status !== 'deleted' && <small>Najkasnije do {formatDate(expiresAt)}.</small>}
        {cleanupError && status === 'deletion_failed' && <small>{cleanupError}</small>}
      </div>
      {terminal && status !== 'deleted' && <button type="button" onClick={() => void deleteTemporaryData()} disabled={busy}>{busy ? 'Brišem…' : 'Izbriši privremene podatke runa'}</button>}
      {message && <p role="status">{message}</p>}
    </section>
  )
}

export function privacyStatusLabel(status: PrivacyStatus): string {
  return ({
    local: 'Samo na ovom uređaju',
    temporarily_uploaded: 'Privremeno u privatnoj pohrani',
    deletion_scheduled: 'Brisanje je zakazano',
    deleted: 'Obrisano iz privremene pohrane',
    deletion_failed: 'Brisanje treba ponoviti',
  } as Record<PrivacyStatus, string>)[status]
}

function formatDate(value: string): string {
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium', timeStyle: 'short' }).format(time) : value
}
