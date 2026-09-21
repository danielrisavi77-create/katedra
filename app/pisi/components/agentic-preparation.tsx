'use client'

import { useCallback, useState } from 'react'

import { AgentTeamSelector, type AgentRunMode, type AgentSourcePolicy } from './agent-team-selector'
import { AgenticProcessPreview } from './agentic-process-preview'
import { MaterialLibrary } from './material-library'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'
import { SNAPSHOT_CONSENT_VERSION } from '../../../lib/agents/snapshot-consent'

const workTypeLabels: Record<ManuscriptV1['workType'], string> = {
  s: 'Seminarski rad',
  z: 'Završni rad',
  d: 'Diplomski rad',
}

export function AgenticPreparation({
  projectId,
  passActive,
  sectionIds,
  manuscript,
  lockedMode,
  webResearchAvailable = false,
  onRunCreated,
}: {
  projectId: string
  passActive: boolean
  sectionIds: string[]
  manuscript: ManuscriptV1
  lockedMode?: 'autonomous'
  webResearchAvailable?: boolean
  onRunCreated: (runId: string) => void
}) {
  const [mode, setMode] = useState<AgentRunMode>(lockedMode || 'guided')
  const [sourcePolicy, setSourcePolicy] = useState<AgentSourcePolicy>('uploaded_only')
  const [materialIds, setMaterialIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [consentProjectId, setConsentProjectId] = useState<string | null>(null)
  const consentAccepted = consentProjectId === projectId
  const handleMaterialsChange = useCallback((materials: Array<{ id?: string; extractionStatus?: string }>) => {
    setMaterialIds(materials
      .filter((material) => typeof material.id === 'string' && material.id.trim().length > 0 && ['extracted', 'partial', 'needs_review'].includes(material.extractionStatus || ''))
      .map((material) => material.id as string))
  }, [])

  if (!passActive) {
    return (
      <section className="pis-agentic-preparation is-locked" aria-labelledby="pis-preparation-locked-title">
        <p className="pis-kicker">Priprema rada</p>
        <h2 id="pis-preparation-locked-title">Aktiviraj Pass za ovaj projekt.</h2>
        <AgenticProcessPreview mode="guided" sourcePolicy="uploaded_only" />
        <p>Materijali, planiranje i vođeni proces izrade dostupni su nakon potvrđene naplate.</p>
      </section>
    )
  }

  const startRun = async () => {
    if (!consentAccepted) return
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/agent-runs?projectId=${encodeURIComponent(projectId)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, sourcePolicy, sectionIds, materialIds, manuscript,
          snapshotConsent: { accepted: true, version: SNAPSHOT_CONSENT_VERSION } }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(agentRequestMessage(response.status, body.error, 'Proces izrade nije moguće pokrenuti.'))
      const runId = String(body.runId || '')
      if (!runId) throw new Error('Pokrenuti tijek nema valjan ID.')
      onRunCreated(runId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pokretanje nije uspjelo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="pis-agentic-preparation" aria-labelledby="pis-preparation-title">
      <header className="pis-agentic-preparation-heading">
        <div>
          <p className="pis-kicker">Zaključani projekt</p>
          <h2 id="pis-preparation-title">Priprema rada</h2>
          <p>Prvo dodaj kontekst rada. Zatim odaberi koliko želiš da Katedra preuzme.</p>
        </div>
        <span className="pis-agent-pass-mark">Pass aktivan</span>
      </header>

      <dl className="pis-project-context" aria-label="Zaključani podaci projekta">
        <div><dt>Rad</dt><dd>{manuscript.title || 'Bez naslova'}</dd></div>
        <div><dt>Vrsta</dt><dd>{workTypeLabels[manuscript.workType]}</dd></div>
        {manuscript.meta.institution && <div><dt>Fakultet</dt><dd>{manuscript.meta.institution}</dd></div>}
        {manuscript.meta.program && <div><dt>Smjer</dt><dd>{manuscript.meta.program}</dd></div>}
      </dl>
      <p className="pis-lock-note"><strong>Važno</strong> Tema i vrsta rada zaključane su za ovaj Pass. Možeš urediti materijale i plan tijeka, ali ne i pretvoriti ovaj projekt u drugi rad.</p>

      <div className="pis-preparation-step">
        <div className="pis-preparation-step-label"><span>01</span><div><b>Dodaj ono što već imaš</b><small>Rad, literaturu, mentorove upute, pravila fakulteta ili bilješke.</small></div></div>
        <MaterialLibrary projectId={projectId} onMaterialsChange={handleMaterialsChange} />
      </div>

      <div className="pis-preparation-step">
        <div className="pis-preparation-step-label"><span>02</span><div><b>Odredi granice rada</b><small>Katedra odabire tehničku postavu. Ti određuješ izvore i razinu samostalnosti.</small></div></div>
        <AgentTeamSelector mode={mode} sourcePolicy={sourcePolicy} lockedMode={lockedMode} webResearchAvailable={webResearchAvailable} onModeChange={setMode} onSourcePolicyChange={setSourcePolicy} />
      </div>

      <AgenticProcessPreview mode={mode} sourcePolicy={sourcePolicy} />

      <div className="pis-preparation-step pis-preparation-start">
        <div className="pis-preparation-step-label"><span>03</span><div><b>Pokreni izradu rada</b><small>Tijek se izvršava po kontrolnim točkama. Možeš zatvoriti preglednik, pauzirati ga i kasnije urediti kontekst.</small></div></div>
        <label><input type="checkbox" checked={consentAccepted} disabled={busy} onChange={(event) => setConsentProjectId(event.target.checked ? projectId : null)} /> Pristajem na privatnu privremenu pohranu sadržaja ovog tijeka, najviše 72 sata, radi rada agenata. Povlačenjem pristanka ili brisanjem tijeka tražim brisanje privremenog sadržaja.</label>
        <button type="button" className="is-primary" disabled={busy || !consentAccepted} onClick={() => void startRun()}>{busy ? 'Pokrećem…' : mode === 'autonomous' ? 'Pokreni autonomni tijek' : 'Pokreni tijek'}</button>
      </div>
      {message && <p className="pis-agent-message" role="alert">{message}</p>}
    </section>
  )
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
