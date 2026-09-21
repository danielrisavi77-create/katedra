import type { ManuscriptAiAction } from './context'

type LocalStorage = Pick<Storage, 'getItem' | 'setItem'> | null
type Outcome = 'requested' | 'completed' | 'failed' | 'cancelled'
type Decision = 'none' | 'accepted' | 'rejected' | 'discarded'
type AttemptIdentity = { projectId: string; proposalId: string; sectionId: string; action: ManuscriptAiAction }
export type AiLedgerEntry = AttemptIdentity & {
  requestedAt: string; finishedAt?: string; decidedAt?: string; outcome: Outcome; decision: Decision
  model?: string; traceRequestId?: string
  userInitiated: true; mode: 'manual'; sourceBacked: 'unknown'; policy: 'unknown'; billing: 'unknown'
}
const ACTIONS = new Set(['question', 'draft', 'expand', 'shorten', 'improve', 'review', 'mentor', 'coach', 'next'])
const OUTCOMES = new Set(['requested', 'completed', 'failed', 'cancelled'])
const DECISIONS = new Set(['none', 'accepted', 'rejected', 'discarded'])
const key = (projectId: string) => `katedra_ai_ledger_v1:${projectId}`
const opaque = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,200}$/.test(value)
const date = (value: unknown): value is string => typeof value === 'string' && value.length <= 30 && Number.isFinite(Date.parse(value))

function projectEntry(value: unknown, projectId: string): AiLedgerEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (row.projectId !== projectId || !opaque(row.proposalId) || !opaque(row.sectionId)
    || typeof row.action !== 'string' || !ACTIONS.has(row.action) || !date(row.requestedAt)
    || typeof row.outcome !== 'string' || !OUTCOMES.has(row.outcome)
    || typeof row.decision !== 'string' || !DECISIONS.has(row.decision)) return null
  if (row.outcome !== 'requested' && !date(row.finishedAt)) return null
  if (row.decision !== 'none' && row.outcome !== 'completed') return null
  if (row.decision !== 'none' && !date(row.decidedAt)) return null
  // Explicit projection on every read/write/export; never spread stored rows.
  return {
    projectId, proposalId: row.proposalId, sectionId: row.sectionId, action: row.action as ManuscriptAiAction,
    requestedAt: row.requestedAt, outcome: row.outcome as Outcome, decision: row.decision as Decision,
    ...(date(row.finishedAt) ? { finishedAt: row.finishedAt } : {}),
    ...(date(row.decidedAt) ? { decidedAt: row.decidedAt } : {}),
    ...(opaque(row.model) ? { model: row.model } : {}),
    ...(opaque(row.traceRequestId) ? { traceRequestId: row.traceRequestId } : {}),
    userInitiated: true, mode: 'manual', sourceBacked: 'unknown', policy: 'unknown', billing: 'unknown',
  }
}

export function readAiLedger(storage: LocalStorage, projectId: string): {
  schemaVersion: 1; projectId: string; entries: AiLedgerEntry[]; status: 'available' | 'unavailable' | 'invalid'
} {
  const empty = { schemaVersion: 1 as const, projectId, entries: [] as AiLedgerEntry[] }
  if (!storage || !opaque(projectId)) return { ...empty, status: 'unavailable' }
  try {
    const raw = storage.getItem(key(projectId))
    if (raw === null) return { ...empty, status: 'available' }
    if (raw.length > 2 * 1024 * 1024) return { ...empty, status: 'invalid' }
    const body = JSON.parse(raw)
    if (body?.schemaVersion !== 1 || body.projectId !== projectId || !Array.isArray(body.entries)) return { ...empty, status: 'invalid' }
    const seen = new Set<string>()
    const entries: AiLedgerEntry[] = []
    for (const value of body.entries.slice(-200)) {
      const entry = projectEntry(value, projectId)
      if (entry && !seen.has(entry.proposalId)) { seen.add(entry.proposalId); entries.push(entry) }
    }
    return { ...empty, entries, status: 'available' }
  } catch { return { ...empty, status: 'unavailable' } }
}

export function exportAiLedger(storage: LocalStorage, projectId: string): string {
  return JSON.stringify(readAiLedger(storage, projectId), null, 2)
}

/** Local best-effort provenance, not billing authority or a synchronized audit trail. */
export function createAiLedgerAttempt(storage: LocalStorage, identity: AttemptIdentity, now = () => new Date().toISOString()) {
  let saved = false
  let hadWriteFailure = false
  let local: AiLedgerEntry | null = null
  const initial = projectEntry({ ...identity, requestedAt: now(), outcome: 'requested', decision: 'none' }, identity.projectId)
  const mutate = (change: (previous: AiLedgerEntry) => AiLedgerEntry | null): boolean => {
    if (!initial) { saved = false; hadWriteFailure = true; return false }
    const current = readAiLedger(storage, identity.projectId)
    const previous = current.entries.find(entry => entry.proposalId === identity.proposalId)
    if (previous && (previous.sectionId !== identity.sectionId || previous.action !== identity.action)) return false
    const updated = change(local || previous || initial)
    if (!updated) return false
    const projected = projectEntry(updated, identity.projectId)
    if (!projected) return false
    // Persistence can fail independently of the real request lifecycle. Keep
    // that lifecycle so a later finally/cancel cannot falsify the outcome.
    local = projected
    if (!storage || current.status !== 'available') { saved = false; hadWriteFailure = true; return false }
    const entries = previous ? current.entries.map(entry => entry.proposalId === identity.proposalId ? projected : entry) : [...current.entries, projected].slice(-200)
    try {
      storage.setItem(key(identity.projectId), JSON.stringify({ schemaVersion: 1, projectId: identity.projectId, entries }))
      saved = true
    } catch { saved = false; hadWriteFailure = true }
    return saved
  }
  const finish = (outcome: Exclude<Outcome, 'requested'>) => mutate(previous => previous.outcome === 'requested' ? { ...previous, outcome, finishedAt: now() } : null)
  mutate(previous => previous)
  return {
    projectId: identity.projectId, proposalId: identity.proposalId,
    get saved() { return saved && !hadWriteFailure },
    setResponseIdentity: (model: string | null, traceRequestId: string | null) => mutate(previous => previous.outcome === 'requested' ? {
      ...previous, ...(opaque(model) ? { model } : {}), ...(opaque(traceRequestId) ? { traceRequestId } : {}),
    } : null),
    complete: () => finish('completed'), fail: () => finish('failed'), cancel: () => finish('cancelled'),
    decide: (decision: Exclude<Decision, 'none'>) => mutate(previous => previous.outcome === 'completed' && previous.decision === 'none' ? { ...previous, decision, decidedAt: now() } : null),
  }
}
