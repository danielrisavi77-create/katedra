'use client'

import { useCallback, useState } from 'react'

import { MaterialLibrary } from './material-library'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'

export function AgenticIntervention({ runId, projectId, manuscript, reason, onResumed }: { runId: string; projectId: string; manuscript: ManuscriptV1; reason: string; onResumed: (manuscript: ManuscriptV1) => void }) {
  const [draft, setDraft] = useState(manuscript)
  const [materialIds, setMaterialIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const handleMaterialsChange = useCallback((materials: Array<{ id: string }>) => {
    setMaterialIds(materials.map((material) => material.id))
  }, [])

  const updateSectionTitle = (sectionId: string, title: string) => {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) => section.id === sectionId ? { ...section, title, updatedAt: new Date().toISOString() } : section),
      updatedAt: new Date().toISOString(),
    }))
  }

  const resume = async () => {
    setBusy(true)
    setMessage('')
    try {
      const context = await fetch(`/api/agent-runs/${encodeURIComponent(runId)}/context`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ manuscript: draft, materialIds }),
      })
      const contextBody = await context.json().catch(() => ({}))
      if (!context.ok) throw new Error(agentRequestMessage(context.status, contextBody.error, 'Novi kontekst nije moguće spremiti.'))
      const response = await fetch(`/api/agent-runs/${encodeURIComponent(runId)}/resume`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(agentRequestMessage(response.status, body.error, 'Tijek nije moguće nastaviti.'))
      onResumed(draft)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nastavak nije uspio.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="pis-agentic-intervention" aria-labelledby="pis-intervention-title">
    <header className="pis-agentic-dashboard-heading"><div><p className="pis-kicker">Potrebni kontekst</p><h2 id="pis-intervention-title">Dodaj kontekst</h2><p>Tijek čeka tvoju dopunu. Uredi kontekst, pa nastavi bez diranja glavnog rukopisa.</p></div><span className="pis-agent-run-mode">Čeka tvoju odluku</span></header>
    <p className="pis-agentic-blocked" role="alert"><strong>Zaustavljeno jer</strong> {reason || 'Provjera traži dodatni kontekst.'}</p>
    <div className="pis-intervention-grid">
      <section aria-labelledby="pis-intervention-plan-title"><div className="pis-agentic-section-heading"><div><p className="pis-kicker">Plan</p><h3 id="pis-intervention-plan-title">Uredi strukturu</h3></div></div><p className="pis-agent-copy">Ovdje mijenjaš samo kontekst sljedećeg pokušaja. Glavni lokalni rukopis ostaje nepromijenjen.</p><ol className="pis-intervention-outline">{draft.sections.map((section) => <li key={section.id}><span>{String(section.order + 1).padStart(2, '0')}</span><input aria-label={`Naslov sekcije ${section.id}`} value={section.title} onChange={(event) => updateSectionTitle(section.id, event.target.value)} /></li>)}</ol></section>
      <MaterialLibrary projectId={projectId} onMaterialsChange={handleMaterialsChange} />
    </div>
    <div className="pis-intervention-actions"><span>Odabrano materijala: {materialIds.length}</span><button type="button" className="is-primary" disabled={busy} onClick={() => void resume()}>{busy ? 'Spremam kontekst…' : 'Spremi kontekst i nastavi'}</button></div>
    {message && <p className="pis-agent-message" role="alert">{message}</p>}
  </section>
}

function agentRequestMessage(status: number, detail: unknown, fallback: string): string {
  if (typeof detail === 'string' && detail.trim()) return detail
  return ({
    401: 'Prijavi se kako bi nastavio ovaj projekt.',
    402: 'Aktiviraj Pass za ovaj projekt kako bi nastavio.',
    403: 'Ovaj projekt ili način rada nije dostupan za tvoj račun.',
    429: 'Previše zahtjeva u kratkom vremenu. Pričekaj trenutak pa pokušaj ponovno.',
    503: 'Proces izrade trenutačno nije dostupan. Pokušaj ponovno kasnije.',
  } as Record<number, string>)[status] || fallback
}
