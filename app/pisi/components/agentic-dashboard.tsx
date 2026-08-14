'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { ManuscriptV1 } from '../../../lib/manuscript/types'
import { AgenticTimeline, type AgenticTimelineStep } from './agentic-timeline'
import { ReadOnlyManuscriptPreview } from './read-only-manuscript-preview'

type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'blocked' | 'failed' | 'cancelled'
type AgenticRun = { runId: string; status: RunStatus; mode?: string; steps: AgenticTimelineStep[] }

export function AgenticDashboard({ runId, projectId, manuscript, onReset, onIntervention }: { runId: string; projectId: string; manuscript: ManuscriptV1; onReset?: () => void; onIntervention?: () => void }) {
  const [run, setRun] = useState<AgenticRun | null>(null)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/agent-runs/${encodeURIComponent(runId)}?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' }).catch(() => null)
    if (!response?.ok) {
      if (response) setMessage('Tijek trenutačno nije moguće učitati.')
      return
    }
    const body = await response.json().catch(() => ({}))
    if (!body.run) return
    setRun(normalizeRun(body))
  }, [projectId, runId])

  useEffect(() => {
    let cancelled = false
    const load = async () => { if (!cancelled) await refresh() }
    void load()
    const timer = window.setInterval(() => void load(), 4000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [refresh])

  const transition = async (action: 'pause' | 'resume') => {
    setMessage('')
    const response = await fetch(`/api/agent-runs/${encodeURIComponent(runId)}/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId }),
    }).catch(() => null)
    if (!response?.ok) {
      const body = await response?.json().catch(() => ({}))
      setMessage(body?.error || 'Promjena statusa nije uspjela.')
      return
    }
    await refresh()
  }

  const cancel = async () => {
    const response = await fetch(`/api/agent-runs/${encodeURIComponent(runId)}?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' }).catch(() => null)
    if (!response?.ok) { setMessage('Otkazivanje tijeka nije uspjelo.'); return }
    await refresh()
  }

  const activeStep = useMemo(() => run?.steps.find((step) => ['running', 'retrying'].includes(step.status)) || run?.steps.find((step) => step.status === 'pending'), [run?.steps])
  const blocked = run?.status === 'blocked' || run?.status === 'failed'

  return <section className="pis-agentic-dashboard" aria-live="polite">
    <header className="pis-agentic-dashboard-heading">
      <div><p className="pis-kicker">Agentički workspace</p><h2>Autonomni tijek</h2><p>{activeStep ? `${label(activeStep.agent)} trenutno radi, a ${label(activeStep.verifier)} priprema provjeru.` : run ? runDescription(run.status) : 'Učitavam zadnji checkpoint…'}</p></div>
      {run && <span className="pis-agent-run-mode">{run.mode || 'autonomno'}</span>}
    </header>
    {run && <div className="pis-agentic-dashboard-actions">
      {run.status === 'running' && <button type="button" onClick={() => void transition('pause')}>Pauziraj tijek</button>}
      {run.status === 'paused' && <button type="button" className="is-primary" onClick={() => void transition('resume')}>Nastavi tijek</button>}
      {['running', 'paused', 'pending'].includes(run.status) && <button type="button" onClick={() => void cancel()}>Otkaži</button>}
      {['completed', 'cancelled'].includes(run.status) && onReset && <button type="button" onClick={onReset}>Novi tijek</button>}
      {blocked && <button type="button" className="is-primary" onClick={() => onIntervention?.()}>Uredi kontekst i nastavi</button>}
    </div>}
    {blocked && <p className="pis-agentic-blocked" role="alert"><strong>Potrebna je intervencija</strong> Uredi materijale ili plan, zatim nastavi od zadnjeg checkpointa.</p>}
    <div className="pis-agentic-dashboard-grid">
      <AgenticTimeline steps={run?.steps || []} />
      <ReadOnlyManuscriptPreview manuscript={manuscript} />
    </div>
    {message && <p className="pis-agent-message" role="alert">{message}</p>}
  </section>
}

function normalizeRun(body: Record<string, unknown>): AgenticRun {
  const rawRun = body.run as Record<string, unknown>
  const steps = Array.isArray(body.steps) ? body.steps : []
  return {
    runId: String(rawRun.run_id || rawRun.runId || ''),
    status: rawRun.status as RunStatus,
    mode: typeof rawRun.mode === 'string' ? rawRun.mode : undefined,
    steps: steps.map((value) => {
      const step = value as Record<string, unknown>
      const verification = step.last_verification || step.lastVerification
      return { id: String(step.step_id || step.id || ''), agent: String(step.agent || ''), verifier: String(step.verifier || ''), status: String(step.status || 'pending'), attempt: Number(step.attempt || 1), lastVerification: verification as AgenticTimelineStep['lastVerification'] }
    }),
  }
}

function label(value: string) {
  return value.replace(/_verifier$/u, ' verifikator').replace(/(^|[ _-])([a-z])/gu, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
}

function runDescription(status: RunStatus) {
  return ({ pending: 'Tijek je pripremljen i čeka prvi checkpoint.', running: 'Agenti rade po redoslijedu.', paused: 'Tijek je pauziran; rukopis je siguran.', completed: 'Tijek je završen i čeka tvoj pregled.', blocked: 'Jedan rezultat treba tvoju odluku.', failed: 'Tijek je zaustavljen zbog greške.', cancelled: 'Tijek je otkazan; rukopis je ostao nepromijenjen.' } as Record<RunStatus, string>)[status] || 'Status tijeka nije poznat.'
}
