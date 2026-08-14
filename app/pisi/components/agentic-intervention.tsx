'use client'

import { useCallback, useEffect, useState } from 'react'

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

  useEffect(() => setDraft(manuscript), [manuscript])

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
      if (!context.ok) throw new Error(contextBody.error || 'Novi kontekst nije moguće spremiti.')
      const response = await fetch(`/api/agent-runs/${encodeURIComponent(runId)}/resume`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Tijek nije moguće nastaviti.')
      onResumed(draft)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nastavak nije uspio.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="pis-agentic-intervention" aria-labelledby="pis-intervention-title">
    <header className="pis-agentic-dashboard-heading"><div><p className="pis-kicker">Tvoja odluka</p><h2 id="pis-intervention-title">Intervencija</h2><p>Run je zaustavljen na checkpointu. Uredi kontekst, pa nastavi bez diranja glavnog rukopisa.</p></div><span className="pis-agent-run-mode">Run pauziran</span></header>
    <p className="pis-agentic-blocked" role="alert"><strong>Zašto je zaustavljen</strong> {reason || 'Verifikator traži dodatni kontekst.'}</p>
    <div className="pis-intervention-grid">
      <section aria-labelledby="pis-intervention-plan-title"><div className="pis-agentic-section-heading"><div><p className="pis-kicker">Plan</p><h3 id="pis-intervention-plan-title">Uredi strukturu</h3></div></div><p className="pis-agent-copy">Ovdje mijenjaš samo kontekst sljedećeg pokušaja. Glavni lokalni rukopis ostaje nepromijenjen.</p><ol className="pis-intervention-outline">{draft.sections.map((section) => <li key={section.id}><span>{String(section.order + 1).padStart(2, '0')}</span><input aria-label={`Naslov sekcije ${section.id}`} value={section.title} onChange={(event) => updateSectionTitle(section.id, event.target.value)} /></li>)}</ol></section>
      <MaterialLibrary projectId={projectId} onMaterialsChange={handleMaterialsChange} />
    </div>
    <div className="pis-intervention-actions"><span>Odabrano materijala: {materialIds.length}</span><button type="button" className="is-primary" disabled={busy} onClick={() => void resume()}>{busy ? 'Spremam kontekst…' : 'Spremi kontekst i nastavi'}</button></div>
    {message && <p className="pis-agent-message" role="alert">{message}</p>}
  </section>
}
