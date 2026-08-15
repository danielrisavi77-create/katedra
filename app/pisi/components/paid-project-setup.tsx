'use client'

import { useEffect, useState } from 'react'

import { AgentRunPanel } from './agent-run-panel'
import { AgenticPreparation } from './agentic-preparation'
import { AgenticIntervention } from './agentic-intervention'
import type { AgenticDraftV1 } from '../../../lib/manuscript/agentic-revisions'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'
import type { AgenticWorkspacePhase } from '../../../lib/manuscript/workspace-view'

export type { AgenticWorkspacePhase } from '../../../lib/manuscript/workspace-view'

const RUN_STORAGE_PREFIX = 'katedra_agent_run_v1:'
const RESUMABLE_STATUSES = new Set(['pending', 'running', 'paused', 'blocked'])

export function PaidProjectSetup({ projectId, passActive, sectionIds, manuscript, requestedPhase, onPhaseChange, onAcceptDraft }: { projectId: string; passActive: boolean; sectionIds: string[]; manuscript: ManuscriptV1; requestedPhase?: AgenticWorkspacePhase; onPhaseChange?: (phase: AgenticWorkspacePhase) => void; onAcceptDraft?: (draft: AgenticDraftV1, sectionIds?: string[]) => Promise<boolean> }) {
  const [runId, setRunId] = useState('')
  const [intervention, setIntervention] = useState(false)

  useEffect(() => {
    if (!passActive || !projectId) return
    let cancelled = false
    const storageKey = `${RUN_STORAGE_PREFIX}${projectId}`
    const resume = async () => {
      const storedRunId = readStoredRunId(storageKey)
      const response = await fetch(`/api/agent-runs?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' }).catch(() => null)
      if (!response?.ok) {
        if (storedRunId && !cancelled) setRunId(storedRunId)
        return
      }
      const body = await response.json().catch(() => ({})) as { runs?: unknown }
      if (!Array.isArray(body.runs)) return
      const runRecords = body.runs.filter((run): run is Record<string, unknown> => Boolean(run && typeof run === 'object'))
      const storedRunStillExists = storedRunId && runRecords.some((run) => run.run_id === storedRunId)
      if (storedRunStillExists) {
        if (!cancelled) setRunId(storedRunId)
        return
      }
      if (storedRunId) removeStoredRunId(storageKey)
      const active = runRecords.find((run) => {
        return typeof run.run_id === 'string' && RESUMABLE_STATUSES.has(String(run.status || ''))
      }) as Record<string, unknown> | undefined
      const nextRunId = typeof active?.run_id === 'string' ? active.run_id.trim() : ''
      if (!nextRunId || cancelled) return
      writeStoredRunId(storageKey, nextRunId)
      setRunId(nextRunId)
    }
    void resume()
    return () => { cancelled = true }
  }, [passActive, projectId])

  const rememberRun = (nextRunId: string) => {
    writeStoredRunId(`${RUN_STORAGE_PREFIX}${projectId}`, nextRunId)
    setRunId(nextRunId)
    onPhaseChange?.(requestedPhase === 'review' ? 'review' : 'dashboard')
  }

  const resetRun = () => {
    removeStoredRunId(`${RUN_STORAGE_PREFIX}${projectId}`)
    setRunId('')
    setIntervention(false)
    onPhaseChange?.('preparation')
  }

  if (runId && intervention) return <AgenticIntervention runId={runId} projectId={projectId} manuscript={manuscript} reason="Verifikator je zatražio dodatni kontekst prije nastavka." onResumed={() => { setIntervention(false); onPhaseChange?.('dashboard') }} />
  if (runId) return <AgentRunPanel runId={runId} projectId={projectId} manuscript={manuscript} requestedPhase={requestedPhase} onReset={resetRun} onIntervention={() => { setIntervention(true); onPhaseChange?.('intervention') }} onAcceptDraft={onAcceptDraft} />
  if (requestedPhase === 'review') return <section className="pis-agentic-preparation" aria-labelledby="pis-agentic-review-empty-title"><p className="pis-kicker">Revizija</p><h2 id="pis-agentic-review-empty-title">Pregled rezultata</h2><p>Provjereni rezultati pojavit će se nakon pokrenutog tijeka i njegove verifikacije.</p><button type="button" className="is-primary" onClick={() => onPhaseChange?.('preparation')}>Pripremi tijek</button></section>
  return (
    <div className="pis-paid-project-setup">
      <header className="pis-paid-project-heading">
        <p className="pis-kicker">Zaključani projekt</p>
        <h2>Priprema projekta: {manuscript.title || 'Rad bez naslova'}</h2>
        <p>Ovaj projekt: {manuscript.title || 'Rad bez naslova'} · Opseg Passa: {workTypeLabel(manuscript.workType)}</p>
      </header>
      <AgenticPreparation projectId={projectId} passActive={passActive} sectionIds={sectionIds} manuscript={manuscript} onRunCreated={rememberRun} />
    </div>
  )
}

function workTypeLabel(workType: ManuscriptV1['workType']): string {
  return ({ s: 'Seminarski rad', z: 'Završni rad', d: 'Diplomski rad' } as Record<ManuscriptV1['workType'], string>)[workType]
}

function readStoredRunId(storageKey: string): string {
  try {
    const value = window.localStorage.getItem(storageKey)
    return typeof value === 'string' && value.trim().length <= 200 ? value.trim() : ''
  } catch {
    return ''
  }
}

function writeStoredRunId(storageKey: string, runId: string): void {
  try { window.localStorage.setItem(storageKey, runId.slice(0, 200)) } catch {}
}

function removeStoredRunId(storageKey: string): void {
  try { window.localStorage.removeItem(storageKey) } catch {}
}
