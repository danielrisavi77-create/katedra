'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createAgenticDraft, upsertSectionRevision, type AgenticDraftV1 } from '../../../lib/manuscript/agentic-revisions'
import { buildRunStudioEvents, currentRunStudioStatus, type RunStudioEvent } from '../../../lib/agents/run-studio'
import { plainTextDocument } from '../../../lib/manuscript/model'
import { isSafeManuscriptHref } from '../../../lib/manuscript/links'
import type { ManuscriptV1, TiptapNode } from '../../../lib/manuscript/types'
import type { AgenticWorkspacePhase } from '../../../lib/manuscript/workspace-view'
import { AgenticTimeline, projectAgentStatus, type AgenticTimelineStep } from './agentic-timeline'
import { AgenticReview, type AgenticReviewDraft, type AgenticReviewEvidence } from './agentic-review'
import { AgenticEventFeed } from './agentic-event-feed'
import { ReadOnlyManuscriptPreview } from './read-only-manuscript-preview'

type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'blocked' | 'failed' | 'cancelled'
type AgenticRun = { runId: string; status: RunStatus; mode?: string; steps: AgenticTimelineStep[] }
type LocalDraftOverride = {
  sectionId: string
  baseRevision: string
  proposedContent: TiptapNode
  status: 'generated' | 'rejected' | 'accepted'
  verificationMessage?: string
  updatedAt: string
}

const DRAFT_STORAGE_PREFIX = 'katedra_agent_draft_v1:'

export function AgenticDashboard({ runId, projectId, manuscript, requestedPhase, onReset, onIntervention, onAcceptDraft, onOpenSection, onOpenAssistant }: { runId: string; projectId: string; manuscript: ManuscriptV1; requestedPhase?: AgenticWorkspacePhase; onReset?: () => void; onIntervention?: () => void; onAcceptDraft?: (draft: AgenticDraftV1, sectionIds?: string[]) => Promise<boolean>; onOpenSection?: (sectionId: string) => void; onOpenAssistant?: (sectionId?: string) => void }) {
  const [run, setRun] = useState<AgenticRun | null>(null)
  const [draft, setDraft] = useState<AgenticReviewDraft | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [retryable, setRetryable] = useState(false)
  const [runResults, setRunResults] = useState<Record<string, unknown>[]>([])
  const resultSignature = useRef('')
  const localOverridesRef = useRef<Record<string, LocalDraftOverride>>({})

  useEffect(() => {
    localOverridesRef.current = readDraftOverrides(projectId, runId)
    resultSignature.current = ''
  }, [projectId, runId])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/agent-runs/${encodeURIComponent(runId)}?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' }).catch(() => null)
      if (!response?.ok) {
        if (response) {
          setRetryable(false)
          const body = await response.json().catch(() => ({}))
          setMessage(agentRequestMessage(response.status, body?.error, 'Tijek trenutačno nije moguće učitati.'))
        } else {
          setRetryable(true)
          setMessage('Tijek trenutačno nije moguće učitati zbog mrežne greške. Pokušaj ponovno.')
        }
        return
      }
      setRetryable(false)
      setMessage('')
      const body = await response.json().catch(() => ({}))
      if (!body.run) return
      setRun(normalizeRun(body))
      setRunResults(Array.isArray(body.results) ? body.results.filter((value: unknown): value is Record<string, unknown> => isRecord(value)) : [])
      const mergedDraft = mergeDraftOverrides(normalizeDraft(body, manuscript, projectId, runId), localOverridesRef.current)
      localOverridesRef.current = mergedDraft.overrides
      persistDraftOverrides(projectId, runId, mergedDraft.overrides)
      const nextSignature = JSON.stringify(body.results || [])
      if (nextSignature !== resultSignature.current) {
        resultSignature.current = nextSignature
        setDraft(mergedDraft.draft)
      }
    } finally {
      setLoading(false)
    }
  }, [manuscript, projectId, runId])

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
      setMessage(agentRequestMessage(response?.status, body?.error, 'Promjena statusa nije uspjela.'))
      return
    }
    await refresh()
  }

  const cancel = async () => {
    const response = await fetch(`/api/agent-runs/${encodeURIComponent(runId)}?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' }).catch(() => null)
    if (!response?.ok) {
      const body = await response?.json().catch(() => ({}))
      setMessage(agentRequestMessage(response?.status, body?.error, 'Otkazivanje tijeka nije uspjelo.'))
      return
    }
    await refresh()
  }

  const activeStep = useMemo(() => run?.steps.find((step) => ['running', 'retrying'].includes(step.status)) || run?.steps.find((step) => step.status === 'pending'), [run?.steps])
  const activeSummary = useMemo(() => activeStep ? projectAgentStatus(activeStep) : null, [activeStep])
  const studioEvents = useMemo<RunStudioEvent[]>(() => buildRunStudioEvents({
    run: run ? { status: run.status, mode: run.mode } : undefined,
    steps: run?.steps || [],
    results: runResults,
    sections: manuscript.sections.map((section) => ({ id: section.id, title: section.title })),
  }), [manuscript.sections, run, runResults])
  const studioStatus = useMemo(() => currentRunStudioStatus(studioEvents), [studioEvents])
  const blocked = run?.status === 'blocked'
  const editDraft = (sectionId: string, content: TiptapNode) => {
    setDraft((current) => current ? {
      ...current,
      sections: current.sections.map((revision) => {
        if (revision.sectionId !== sectionId) return revision
        const updatedAt = new Date().toISOString()
        const status = revision.status === 'rejected' ? 'rejected' as const : 'generated' as const
        localOverridesRef.current = {
          ...localOverridesRef.current,
          [sectionId]: { sectionId, baseRevision: revision.baseRevision, proposedContent: content, status, verificationMessage: revision.status === 'verified' ? 'Prijedlog je izmijenjen nakon verifikacije; potrebna je nova provjera.' : revision.verificationMessage, updatedAt },
        }
        persistDraftOverrides(projectId, runId, localOverridesRef.current)
        return {
          ...revision,
          proposedContent: content,
          ...(revision.status === 'verified' ? {
            status: 'generated' as const,
            verificationMessage: 'Prijedlog je izmijenjen nakon verifikacije; potrebna je nova provjera.',
          } : {}),
          updatedAt,
        }
      }),
      updatedAt: new Date().toISOString(),
    } : current)
  }
  const rejectDraft = (sectionId: string) => {
    setDraft((current) => current ? {
      ...current,
      sections: current.sections.map((revision) => {
        if (revision.sectionId !== sectionId) return revision
        const updatedAt = new Date().toISOString()
        localOverridesRef.current = {
          ...localOverridesRef.current,
          [sectionId]: { sectionId, baseRevision: revision.baseRevision, proposedContent: revision.proposedContent, status: 'rejected', verificationMessage: revision.verificationMessage, updatedAt },
        }
        persistDraftOverrides(projectId, runId, localOverridesRef.current)
        return { ...revision, status: 'rejected' as const, updatedAt }
      }),
      updatedAt: new Date().toISOString(),
    } : current)
  }

  const acceptDraft = async (sectionIds?: string[]) => {
    if (!draft || !onAcceptDraft) {
      setMessage('Verificirani rezultat nije moguće prihvatiti bez spremanja u glavni rukopis.')
      return false
    }
    const merged = sectionIds ? await onAcceptDraft(draft, sectionIds) : await onAcceptDraft(draft)
    if (!merged) {
      setMessage('Verificirani rezultat nije prihvaćen u glavni rukopis.')
      return false
    }
    const acceptedIds = sectionIds || draft.sections
      .filter((revision) => revision.status === 'verified' && manuscript.sections.some((section) => section.id === revision.sectionId && section.updatedAt === revision.baseRevision))
      .map((revision) => revision.sectionId)
    if (acceptedIds.length === 0) return false
    const updatedAt = new Date().toISOString()
    setDraft((current) => current ? {
      ...current,
      sections: current.sections.map((revision) => acceptedIds.includes(revision.sectionId) ? { ...revision, status: 'accepted' as const, updatedAt } : revision),
      updatedAt,
    } : current)
    localOverridesRef.current = { ...localOverridesRef.current }
    for (const sectionId of acceptedIds) {
      const revision = draft.sections.find((item) => item.sectionId === sectionId)
      if (!revision) continue
      localOverridesRef.current[sectionId] = { sectionId, baseRevision: revision.baseRevision, proposedContent: revision.proposedContent, status: 'accepted', verificationMessage: revision.verificationMessage, updatedAt }
    }
    persistDraftOverrides(projectId, runId, localOverridesRef.current)
    return true
  }

  return <section className="pis-agentic-dashboard" aria-live="polite" aria-busy={loading}>
    <header className="pis-agentic-dashboard-heading">
      <div><p className="pis-kicker">{requestedPhase === 'review' ? 'Pregled rezultata' : 'Radionica rada'}</p><h2>Tijek izrade rada</h2><p>{run ? studioStatus.label : activeSummary ? activeSummaryCopy(activeSummary) : loading ? 'Učitavam zadnji checkpoint…' : 'Tijek nije moguće učitati.'}</p><span className="pis-agentic-live-summary">{run ? studioStatus.summary : 'Katedra će prikazati svaki provjereni korak čim proces započne.'}</span></div>
      {run && <span className="pis-agent-run-mode">{modeLabel(run.mode)}</span>}
    </header>
    {run && <div className="pis-agentic-dashboard-actions">
      {run.status === 'running' && <button type="button" onClick={() => void transition('pause')}>Pauziraj tijek</button>}
      {run.status === 'paused' && <button type="button" className="is-primary" onClick={() => void transition('resume')}>Nastavi tijek</button>}
      {['running', 'paused', 'pending'].includes(run.status) && <button type="button" onClick={() => void cancel()}>Otkaži</button>}
      {['completed', 'cancelled', 'failed'].includes(run.status) && onReset && <button type="button" onClick={onReset}>Novi tijek</button>}
      {blocked && <button type="button" className="is-primary" onClick={() => onIntervention?.()}>Uredi kontekst i nastavi</button>}
    </div>}
    {blocked && <p className="pis-agentic-blocked" role="alert"><strong><span>Potrebna je intervencija</span> — tvoja odluka</strong> Uredi materijale ili plan, zatim nastavi od zadnjeg checkpointa.</p>}
    <div className="pis-agentic-studio-grid">
      <div className="pis-agentic-studio-primary">
        <AgenticEventFeed events={studioEvents} onOpenSection={onOpenSection} />
        <AgenticTimeline steps={run?.steps || []} />
      </div>
      <aside className="pis-agentic-studio-context" aria-label="Kontekst procesa">
        <div className="pis-agentic-current-step"><p className="pis-kicker">Sljedeća radnja</p><strong>{run ? studioStatus.nextAction : 'Pokreni tijek za prikaz procesa.'}</strong>{studioStatus.attempt && <span>Pokušaj {studioStatus.attempt}/3</span>}{onOpenAssistant && <button type="button" className="pis-agentic-ask-button" onClick={() => onOpenAssistant(studioStatus.sectionId || activeStep?.sectionId)}>Pitaj Katedru o ovom koraku</button>}</div>
        <ReadOnlyManuscriptPreview manuscript={manuscript} />
      </aside>
    </div>
    {draft && draft.sections.length > 0 && <AgenticReview manuscript={manuscript} draft={draft} onAccept={acceptDraft} onEdit={editDraft} onReject={rejectDraft} />}
    {message && <><p className="pis-agent-message" role="alert">{message}</p>{retryable && !loading && <button type="button" onClick={() => { setLoading(true); void refresh() }}>Pokušaj ponovno</button>}</>}
  </section>
}

function activeSummaryCopy(summary: ReturnType<typeof projectAgentStatus>): string {
  return summary.state === 'preparing' ? summary.nextAction : `${summary.phaseLabel} je u tijeku. ${summary.nextAction}`
}

function normalizeDraft(body: Record<string, unknown>, manuscript: ManuscriptV1, projectId: string, runId: string): AgenticReviewDraft | null {
  const rawResults = Array.isArray(body.results) ? body.results : []
  let draft = createAgenticDraft({ projectId, runId, base: manuscript })
  for (const value of rawResults) {
    if (!value || typeof value !== 'object') continue
    const result = value as Record<string, unknown>
    const sectionId = typeof result.sectionId === 'string' ? result.sectionId : ''
    const output = typeof result.output === 'string' ? result.output.trim() : ''
    if (!sectionId || !output || !manuscript.sections.some((section) => section.id === sectionId)) continue
    const verification = result.verification && typeof result.verification === 'object' ? result.verification as Record<string, unknown> : {}
    const verificationStatus = verification.status
    const status = verificationStatus === 'verified' ? 'verified' : verificationStatus === 'blocked' ? 'blocked' : 'generated'
    const issues = Array.isArray(verification.issues) ? verification.issues.map((issue) => issue && typeof issue === 'object' && typeof (issue as Record<string, unknown>).message === 'string' ? String((issue as Record<string, unknown>).message) : '').filter(Boolean) : []
    const updatedAt = typeof result.createdAt === 'string' ? result.createdAt : new Date().toISOString()
    const nextDraft = upsertSectionRevision(draft, {
      sectionId,
      baseRevision: typeof result.baseRevision === 'string' ? result.baseRevision : '__missing_base_revision__',
      proposedContent: plainTextDocument(output),
      status,
      verificationMessage: issues.join(' '),
      updatedAt,
    })
    draft = {
      ...nextDraft,
      sections: nextDraft.sections.map((revision) => revision.sectionId === sectionId ? { ...revision, evidence: normalizeEvidence(result, verification) } : revision),
    }
  }
  return draft.sections.length ? draft : null
}

function normalizeEvidence(result: Record<string, unknown>, verification: Record<string, unknown>): AgenticReviewEvidence[] {
  const candidates = [
    ...(Array.isArray(result.citations) ? result.citations : []),
    ...(Array.isArray(result.evidence) ? result.evidence : []),
    ...(Array.isArray(verification.evidence) ? verification.evidence : []),
  ]
  const seen = new Set<string>()
  return candidates.flatMap((value) => {
    if (!value || typeof value !== 'object') return []
    const item = value as Record<string, unknown>
    const id = typeof item.id === 'string' ? item.id : ''
    const title = typeof item.title === 'string' ? item.title : undefined
    const candidateUrl = typeof item.url === 'string' ? item.url : ''
    const url = isSafeManuscriptHref(candidateUrl) ? candidateUrl : undefined
    const doi = typeof item.doi === 'string' ? item.doi : undefined
    const key = id || url || doi || title || ''
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [{ id: key, title, url, doi, verified: item.verified === true, status: typeof item.status === 'string' ? item.status : undefined }]
  })
}

function mergeDraftOverrides(draft: AgenticReviewDraft | null, overrides: Record<string, LocalDraftOverride>): { draft: AgenticReviewDraft | null; overrides: Record<string, LocalDraftOverride> } {
  if (!draft) return { draft, overrides: {} }
  const validOverrides: Record<string, LocalDraftOverride> = {}
  const sections = draft.sections.map((revision) => {
    const override = overrides[revision.sectionId]
    if (!override || override.baseRevision !== revision.baseRevision) return revision
    validOverrides[revision.sectionId] = override
    return { ...revision, proposedContent: override.proposedContent, status: override.status, verificationMessage: override.verificationMessage, updatedAt: override.updatedAt }
  })
  return { draft: { ...draft, sections }, overrides: validOverrides }
}

function readDraftOverrides(projectId: string, runId: string): Record<string, LocalDraftOverride> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = JSON.parse(window.localStorage.getItem(draftStorageKey(projectId, runId)) || 'null') as unknown
    if (!isRecord(raw) || raw.schemaVersion !== 1 || !isRecord(raw.sections)) return {}
    return Object.fromEntries(Object.entries(raw.sections).flatMap(([sectionId, value]) => {
    if (!isRecord(value) || value.sectionId !== sectionId || typeof value.baseRevision !== 'string' || !isSafeTiptapNode(value.proposedContent) || !['generated', 'rejected', 'accepted'].includes(String(value.status)) || typeof value.updatedAt !== 'string') return []
      return [[sectionId, value as unknown as LocalDraftOverride]]
    }))
  } catch {
    return {}
  }
}

function persistDraftOverrides(projectId: string, runId: string, overrides: Record<string, LocalDraftOverride>): void {
  if (typeof window === 'undefined') return
  try {
    const key = draftStorageKey(projectId, runId)
    if (Object.keys(overrides).length === 0) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, sections: overrides }))
  } catch {}
}

function draftStorageKey(projectId: string, runId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${projectId}:${runId}`
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSafeTiptapNode(value: unknown): value is TiptapNode {
  if (!isRecord(value) || typeof value.type !== 'string' || !['doc', 'paragraph', 'heading', 'text', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'hardBreak', 'horizontalRule'].includes(value.type)) return false
  if (value.type === 'text' && typeof value.text !== 'string') return false
  return value.content === undefined || (Array.isArray(value.content) && value.content.every(isSafeTiptapNode))
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
      return { id: String(step.step_id || step.id || ''), sectionId: typeof step.section_id === 'string' ? step.section_id : typeof step.sectionId === 'string' ? step.sectionId : undefined, agent: String(step.agent || ''), verifier: String(step.verifier || ''), status: String(step.status || 'pending'), attempt: Number(step.attempt || 1), provider: typeof step.provider === 'string' ? step.provider : undefined, usage: step.usage as AgenticTimelineStep['usage'], lastVerification: verification as AgenticTimelineStep['lastVerification'] }
    }),
  }
}

function runDescription(status: RunStatus) {
  return ({ pending: 'Tijek je pripremljen i čeka prvi checkpoint.', running: 'Katedra radi po redoslijedu.', paused: 'Tijek je pauziran; rukopis je siguran.', completed: 'Tijek je završen i čeka tvoj pregled.', blocked: 'Jedan rezultat treba tvoju odluku.', failed: 'Tijek je zaustavljen zbog greške.', cancelled: 'Tijek je otkazan; rukopis je ostao nepromijenjen.' } as Record<RunStatus, string>)[status] || 'Status tijeka nije poznat.'
}

function modeLabel(mode?: string): string {
  return ({ guided: 'Vođeno', accelerated: 'Ubrzano', autonomous: 'Samostalno' } as Record<string, string>)[mode || ''] || 'Tijek rada'
}

function agentRequestMessage(status: number | undefined, detail: unknown, fallback: string): string {
  if (typeof detail === 'string' && detail.trim()) return detail
  return ({
    401: 'Prijavi se kako bi nastavio ovaj projekt.',
    402: 'Aktiviraj Pass za ovaj projekt kako bi nastavio.',
    403: 'Ovaj projekt ili način rada nije dostupan za tvoj račun.',
    429: 'Previše zahtjeva u kratkom vremenu. Pričekaj trenutak pa pokušaj ponovno.',
    503: 'Proces izrade trenutačno nije dostupan. Pokušaj ponovno kasnije.',
  } as Record<number, string>)[status || 0] || fallback
}
