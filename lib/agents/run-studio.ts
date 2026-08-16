import { isSafeManuscriptHref } from '../manuscript/links'

export type RunStudioActor = 'katedra' | 'verifier' | 'system'
export type RunStudioEventKind = 'run_started' | 'step_active' | 'verifier_active' | 'step_verified' | 'step_waiting' | 'step_blocked' | 'step_failed' | 'result_ready' | 'source_verified'
export type RunStudioEventStatus = 'active' | 'complete' | 'waiting' | 'warning' | 'blocked' | 'failed'

export interface RunStudioSource {
  id: string
  title: string
  url?: string
  doi?: string
  verified: boolean
}

export interface RunStudioEvent {
  id: string
  actor: RunStudioActor
  kind: RunStudioEventKind
  status: RunStudioEventStatus
  title: string
  summary: string
  occurredAt?: string
  sectionId?: string
  attempt?: 1 | 2 | 3
  sources?: RunStudioSource[]
  details?: string[]
}

export interface RunStudioStatus {
  state: 'active' | 'blocked' | 'waiting' | 'complete' | 'paused' | 'failed'
  label: string
  summary: string
  nextAction: string
  sectionId?: string
  attempt?: 1 | 2 | 3
}

type StepInput = {
  id?: unknown
  step_id?: unknown
  stepOrder?: unknown
  step_order?: unknown
  agent?: unknown
  verifier?: unknown
  sectionId?: unknown
  section_id?: unknown
  status?: unknown
  attempt?: unknown
  lastVerification?: unknown
  last_verification?: unknown
}

type ResultInput = {
  stepId?: unknown
  step_id?: unknown
  sectionId?: unknown
  section_id?: unknown
  createdAt?: unknown
  created_at?: unknown
  output?: unknown
  citations?: unknown
  verification?: unknown
}

type RunInput = { status?: unknown; mode?: unknown }

export function buildRunStudioEvents(input: { run?: RunInput; steps?: StepInput[]; results?: ResultInput[]; sections?: Array<{ id: string; title: string }> }): RunStudioEvent[] {
  if (!input.run) return []
  const events: RunStudioEvent[] = []
  const sectionTitles = new Map((input.sections || []).map((section) => [section.id, section.title]))
  const steps = [...(input.steps || [])].sort((left, right) => numberValue(left.step_order ?? left.stepOrder) - numberValue(right.step_order ?? right.stepOrder))
  const results = input.results || []
  const resultByStep = new Map(results.map((result, index) => [stringValue(result.stepId || result.step_id) || `result-${index}`, result]))
  const runStatus = stringValue(input.run?.status) || 'pending'

  events.push({
    id: 'run-started',
    actor: 'system',
    kind: 'run_started',
    status: runStatus === 'paused' ? 'waiting' : 'complete',
    title: runStatus === 'paused' ? 'Tijek je pauziran' : 'Tijek izrade je pokrenut',
    summary: modeSummary(stringValue(input.run?.mode)),
  })

  let waitingAdded = false
  for (const step of steps) {
    const agent = stringValue(step.agent) || 'next'
    const verifier = stringValue(step.verifier) || `${agent}_verifier`
    const status = stringValue(step.status) || 'pending'
    const sectionId = stringValue(step.section_id ?? step.sectionId) || undefined
    const attempt = normalizeAttempt(step.attempt)
    const phase = describeAgent(agent, sectionId, sectionId ? sectionTitles.get(sectionId) : undefined)
    const verifierLabel = describeVerifier(verifier)
    const issueDetails = verificationIssues(step.last_verification ?? step.lastVerification)
    const base = { sectionId, attempt }

    if (status === 'running' || status === 'retrying') {
      events.push({
        ...base,
        id: `${stepId(step)}:active`,
        actor: 'katedra',
        kind: 'step_active',
        status: 'active',
        title: phase.activeTitle,
        summary: `${phase.phaseLabel} je u tijeku. Nakon toga ${verifierLabel} provjerava rezultat.`,
      })
      events.push({
        ...base,
        id: `${stepId(step)}:verifier`,
        actor: 'verifier',
        kind: 'verifier_active',
        status: 'waiting',
        title: `${verifierLabel} čeka rezultat`,
        summary: attempt > 1 ? `Ovo je pokušaj ${attempt}/3 nakon prethodne provjere.` : 'Provjera će započeti čim Katedra završi ovaj korak.',
      })
      continue
    }

    if (status === 'verified' || status === 'completed') {
      events.push({
        ...base,
        id: `${stepId(step)}:verified`,
        actor: 'verifier',
        kind: 'step_verified',
        status: 'complete',
        title: `${verifierLabel} je potvrdio rezultat`,
        summary: `Korak je prošao provjeru i može prijeći u sljedeći korak.`,
      })
      continue
    }

    if (status === 'blocked') {
      events.push({
        ...base,
        id: `${stepId(step)}:blocked`,
        actor: 'verifier',
        kind: 'step_blocked',
        status: 'blocked',
        title: `${verifierLabel} je zaustavio korak`,
        summary: 'Potrebna je tvoja odluka ili dodatni kontekst prije nastavka.',
        details: issueDetails,
      })
      continue
    }

    if (status === 'failed') {
      events.push({
        ...base,
        id: `${stepId(step)}:failed`,
        actor: 'system',
        kind: 'step_failed',
        status: 'failed',
        title: `${phase.phaseLabel} nije dovršen`,
        summary: issueDetails[0] || 'Korak je zaustavljen zbog neočekivane greške.',
        details: issueDetails,
      })
      continue
    }

    if (!waitingAdded && (status === 'pending' || status === 'preparing')) {
      waitingAdded = true
      events.push({
        ...base,
        id: `${stepId(step)}:waiting`,
        actor: 'system',
        kind: 'step_waiting',
        status: 'waiting',
        title: `Sljedeće: ${phase.phaseLabel}`,
        summary: 'Ovaj korak čeka da prethodna provjera bude završena.',
      })
    }
  }

  for (const [key, result] of resultByStep) {
    const sources = citationsFrom(result.citations)
    const sectionId = stringValue(result.sectionId || result.section_id) || undefined
    const verification = isRecord(result.verification) ? result.verification : undefined
    const verificationStatus = stringValue(verification?.status)
    events.push({
      id: `${key}:result`,
      actor: 'katedra',
      kind: 'result_ready',
      status: verificationStatus === 'blocked' ? 'warning' : 'complete',
      title: 'Rezultat čeka tvoju odluku',
      summary: sources.length ? `Pronađeno je ${sources.length} izvora uz ovaj rezultat.` : 'Pregledaj prijedlog prije nego ga uneseš u rukopis.',
      occurredAt: stringValue(result.createdAt || result.created_at) || undefined,
      sectionId,
      sources,
      details: verificationIssues(result.verification),
    })
    for (const source of sources.filter((item) => item.verified)) {
      events.push({
        id: `${key}:source:${source.id}`,
        actor: 'verifier',
        kind: 'source_verified',
        status: 'complete',
        title: `Izvor je provjeren: ${source.title}`,
        summary: 'Izvor je dostupan kao dokaz uz prijedlog.',
        occurredAt: stringValue(result.createdAt || result.created_at) || undefined,
        sectionId,
        sources: [source],
      })
    }
  }

  return events
}

export function currentRunStudioStatus(events: RunStudioEvent[]): RunStudioStatus {
  const blocked = events.find((event) => event.kind === 'step_blocked')
  if (blocked) return { state: 'blocked', label: 'Tijek čeka tvoju odluku', summary: blocked.summary, nextAction: 'Dodaj traženi kontekst pa pokušaj ponovno.', sectionId: blocked.sectionId, attempt: blocked.attempt }
  const failed = events.find((event) => event.kind === 'step_failed')
  if (failed) return { state: 'failed', label: 'Tijek je zaustavljen zbog greške', summary: failed.summary, nextAction: 'Pokušaj ponovno ili nastavi ručno.', sectionId: failed.sectionId, attempt: failed.attempt }
  const paused = events.find((event) => event.kind === 'run_started' && event.status === 'waiting')
  if (paused) return { state: 'paused', label: 'Tijek je pauziran', summary: paused.summary, nextAction: 'Nastavi tijek kada budeš spreman.' }
  const active = events.find((event) => event.kind === 'step_active')
  if (active) return { state: 'active', label: active.title, summary: active.summary, nextAction: 'Nakon pisanja slijedi provjera rezultata.', sectionId: active.sectionId, attempt: active.attempt }
  const waiting = events.find((event) => event.kind === 'step_waiting')
  if (waiting) return { state: 'waiting', label: waiting.title, summary: waiting.summary, nextAction: 'Tijek će nastaviti kada prethodna provjera završi.', sectionId: waiting.sectionId, attempt: waiting.attempt }
  const result = events.find((event) => event.kind === 'result_ready')
  if (result) return { state: 'complete', label: 'Rezultat je spreman za pregled', summary: result.summary, nextAction: 'Pregledaj prijedlog i odluči što ulazi u rukopis.', sectionId: result.sectionId }
  if (events.some((event) => event.kind === 'step_verified')) return { state: 'complete', label: 'Tijek je završen', summary: 'Svi koraci u ovom tijeku prošli su verifikaciju.', nextAction: 'Pregledaj rukopis ili započni novu verziju.' }
  return { state: 'waiting', label: 'Tijek je pripremljen', summary: 'Čekaju se prvi događaji izrade.', nextAction: 'Pokreni tijek ili pokušaj ponovno učitati stanje.' }
}

function describeAgent(agent: string, sectionId?: string, sectionTitle?: string): { phaseLabel: string; activeTitle: string } {
  const phase = ({
    intake: ['Analiza materijala', 'Katedra čita materijale'],
    sources: ['Literatura', 'Katedra istražuje literaturu'],
    structure: ['Struktura rada', 'Katedra slaže strukturu'],
    planning: ['Plan rada', 'Katedra planira sljedeće korake'],
    writing: ['Pisanje', sectionId ? `Katedra piše poglavlje ${sectionTitle || sectionId}` : 'Katedra piše nacrt'],
    citation: ['Provjera izvora', 'Katedra provjerava tvrdnje'],
    review: ['Provjera rada', 'Katedra pregledava rad'],
    export: ['Priprema za izvoz', 'Katedra priprema završnu verziju'],
  } as Record<string, [string, string]>)[agent] || [humanize(agent), `Katedra radi na koraku: ${humanize(agent)}`]
  return { phaseLabel: phase[0], activeTitle: phase[1] }
}

function describeVerifier(verifier: string): string {
  const agent = verifier.replace(/_verifier$/u, '')
  return ({ intake: 'Verifikator materijala', sources: 'Verifikator literature', structure: 'Verifikator strukture', planning: 'Verifikator plana', writing: 'Verifikator pisanja', citation: 'Verifikator izvora', review: 'Verifikator pregleda', export: 'Verifikator završne verzije' } as Record<string, string>)[agent] || `Verifikator ${humanize(agent)}`
}

function citationsFrom(value: unknown): RunStudioSource[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return []
    const id = stringValue(item.id) || `source-${index + 1}`
    const title = stringValue(item.title) || 'Izvor bez naslova'
    const candidateUrl = stringValue(item.url)
    const url = isSafeManuscriptHref(candidateUrl) ? candidateUrl : undefined
    return [{ id, title, ...(url ? { url } : {}), doi: stringValue(item.doi) || undefined, verified: item.verified === true }]
  })
}

function verificationIssues(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.issues)) return []
  return value.issues.flatMap((issue) => isRecord(issue) && typeof issue.message === 'string' && issue.message.trim() ? [issue.message.trim()] : [])
}

function stepId(step: StepInput): string {
  return stringValue(step.step_id ?? step.id) || `${stringValue(step.agent) || 'step'}-${numberValue(step.step_order ?? step.stepOrder)}`
}

function normalizeAttempt(value: unknown): 1 | 2 | 3 {
  const attempt = numberValue(value)
  return attempt >= 3 ? 3 : attempt === 2 ? 2 : 1
}

function modeSummary(mode: string): string {
  return ({ guided: 'Radiš uz potvrdu ključnih koraka.', accelerated: 'Katedra ubrzava proces, a ti potvrđuješ važne rezultate.', autonomous: 'Katedra radi kroz odobreni opseg i zaustavlja se na provjeri ili problemu.' } as Record<string, string>)[mode] || 'Proces se izvršava kroz provjerene kontrolne točke.'
}

function humanize(value: string): string {
  const words = value.replace(/[_-]+/gu, ' ').trim().split(/\s+/u).filter(Boolean)
  if (words.length === 0) return 'sljedeći korak'
  return words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ')
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
