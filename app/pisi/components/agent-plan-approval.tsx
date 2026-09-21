'use client'

import { useEffect, useState } from 'react'
import type { PlanArtifactV1 } from '../../../lib/agents/plan-artifact'

type Review = { plan: PlanArtifactV1 | null; planRevision: string; ready: boolean; approved: boolean; sectionTitles?: Record<string, string>; sourceLabels?: Record<string, string> }

export function AgentPlanApproval({ runId, projectId, onResumed }: { runId: string; projectId: string; onResumed: () => void }) {
  const [review, setReview] = useState<Review | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let cancelled = false
    void fetch('/api/agent-runs/' + encodeURIComponent(runId) + '/plan-approval', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Plan nije moguće učitati.')
        if (!cancelled) setReview(body)
      }).catch(() => { if (!cancelled) setMessage('Plan trenutno nije moguće učitati.') })
    return () => { cancelled = true }
  }, [runId, reload])

  const approve = async () => {
    if (!review?.ready || review.approved) return
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/agent-runs/' + encodeURIComponent(runId) + '/plan-approval', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, planRevision: review.planRevision, approve: true }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 409) { setReview(null); setReload((value) => value + 1) }
        throw new Error(body.error || 'Plan nije potvrđen.')
      }
      const resumed = await fetch('/api/agent-runs/' + encodeURIComponent(runId) + '/resume', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId }),
      })
      if (!resumed.ok) throw new Error('Plan je potvrđen, ali nastavak nije uspio. Pokušaj ponovno.')
      onResumed()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Potvrda nije uspjela.') }
    finally { setBusy(false) }
  }

  if (review?.approved) return <p>Plan je odobren.</p>

  return <section aria-labelledby="agent-plan-approval-title">
    <h3 id="agent-plan-approval-title">Pregledaj i odobri plan</h3>
    <p>Pisanje čeka tvoju potvrdu ove verzije plana. Izmjena plana tražit će novu potvrdu.</p>
    {review?.plan && <div>
      <p><strong>Teza:</strong> {review.plan.thesis}</p>
      {review.plan.question && <p><strong>Istraživačko pitanje:</strong> {review.plan.question}</p>}
      <ul>{review.plan.perspectives.map((perspective, index) => <li key={index}><strong>{perspective.label}:</strong> {perspective.position} — {perspective.why}</li>)}</ul>
      <ol>{review.plan.chapters.map((chapter, index) => <li key={index}><strong>{chapter.title || review.sectionTitles?.[chapter.sectionId || ''] || 'Poglavlje'}</strong>{chapter.pages !== undefined && <span> ({chapter.pages} str.)</span>}<p>{chapter.content}</p><p>Izvori: {chapter.sources?.map((id) => review.sourceLabels?.[id] || 'Izvor nije dostupan').join('; ') || 'Nisu navedeni'}</p></li>)}</ol>
    </div>}
    {review && !review.ready && <p>Plan još nema sve potrebne podatke. Dopuni kontekst pa zatraži novi prijedlog.</p>}
    <button type="button" className="is-primary" disabled={busy || !review?.ready} onClick={() => void approve()}>{busy ? 'Potvrđujem…' : 'Odobri plan i nastavi'}</button>
    {message && <p role="alert">{message}</p>}
    {!review && message && <button type="button" onClick={() => { setMessage(''); setReload((value) => value + 1) }}>Ponovno učitaj plan</button>}
  </section>
}
