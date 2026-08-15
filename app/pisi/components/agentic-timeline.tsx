'use client'

export interface AgenticTimelineStep {
  id: string
  agent: string
  verifier: string
  status: string
  attempt: number
  provider?: string
  usage?: { input_tokens?: number; output_tokens?: number; inputTokens?: number; outputTokens?: number }
  lastVerification?: { issues?: Array<{ message?: string }> }
}

export type AgentStatusState = 'preparing' | 'running' | 'ready' | 'blocked' | 'failed' | 'paused'

export type AgentStatusSummary = {
  phaseLabel: string
  agentLabel: string
  verifierLabel: string
  attempt: 1 | 2 | 3
  state: AgentStatusState
  nextAction: string
}

const PHASES: Record<string, { phaseLabel: string; agentLabel: string; verifierLabel: string }> = {
  intake: { phaseLabel: 'Analiza materijala', agentLabel: 'Katedra čita materijale', verifierLabel: 'Verifikator materijala' },
  sources: { phaseLabel: 'Literatura', agentLabel: 'Katedra istražuje literaturu', verifierLabel: 'Verifikator literature' },
  structure: { phaseLabel: 'Struktura rada', agentLabel: 'Katedra slaže strukturu', verifierLabel: 'Verifikator strukture' },
  planning: { phaseLabel: 'Plan rada', agentLabel: 'Katedra planira sljedeće korake', verifierLabel: 'Verifikator plana' },
  writing: { phaseLabel: 'Pisanje', agentLabel: 'Katedra priprema nacrt', verifierLabel: 'Verifikator pisanja' },
  citation: { phaseLabel: 'Provjera izvora', agentLabel: 'Katedra provjerava tvrdnje', verifierLabel: 'Verifikator izvora' },
  review: { phaseLabel: 'Provjera rada', agentLabel: 'Katedra pregledava rad', verifierLabel: 'Verifikator pregleda' },
  export: { phaseLabel: 'Priprema za izvoz', agentLabel: 'Katedra priprema završnu verziju', verifierLabel: 'Verifikator završne verzije' },
}

export function projectAgentStatus(step: AgenticTimelineStep): AgentStatusSummary {
  const phase = PHASES[step.agent] || {
    phaseLabel: humanize(step.agent),
    agentLabel: 'Katedra priprema rezultat',
    verifierLabel: 'Verifikator rezultata',
  }
  const state = stateFor(step.status)

  return {
    ...phase,
    attempt: normalizeAttempt(step.attempt),
    state,
    nextAction: nextActionFor(phase.phaseLabel, state),
  }
}

export function AgenticTimeline({ steps }: { steps: AgenticTimelineStep[] }) {
  return (
    <section className="pis-agentic-timeline" aria-labelledby="pis-agentic-timeline-title">
      <header className="pis-agentic-section-heading"><div><p className="pis-kicker">Tijek rada</p><h3 id="pis-agentic-timeline-title">Koraci izrade</h3></div><span>{steps.filter((step) => step.status === 'verified').length}/{steps.length || 0} provjereno</span></header>
      <ol className="pis-agentic-timeline-list">
        {steps.map((step) => {
          const summary = projectAgentStatus(step)
          const issue = step.lastVerification?.issues?.find((item) => item.message)?.message
          return <li key={step.id} data-status={step.status} data-state={summary.state}>
            <span className="pis-timeline-marker" aria-hidden="true">{step.status === 'verified' ? '✓' : step.status === 'blocked' ? '!' : step.status === 'running' || step.status === 'retrying' ? '→' : '·'}</span>
            <div className="pis-timeline-step-copy"><b>{summary.phaseLabel}</b><small>{summary.agentLabel} · {summary.verifierLabel} · Pokušaj {summary.attempt}/3{usageLabel(step.usage) ? ` · ${usageLabel(step.usage)}` : ''}</small><p className="pis-timeline-next">{summary.nextAction}</p>{issue && <p>{issue}</p>}</div>
            <em>{statusLabel(step.status)}</em>
          </li>
        })}
      </ol>
    </section>
  )
}

function stateFor(status: string): AgentStatusState {
  if (status === 'running' || status === 'retrying') return 'running'
  if (status === 'verified' || status === 'completed') return 'ready'
  if (status === 'blocked') return 'blocked'
  if (status === 'failed') return 'failed'
  if (status === 'paused') return 'paused'
  return 'preparing'
}

function normalizeAttempt(value: number): 1 | 2 | 3 {
  if (value >= 3) return 3
  if (value === 2) return 2
  return 1
}

function nextActionFor(phaseLabel: string, state: AgentStatusState): string {
  if (state === 'running') return `${phaseLabel} je u tijeku. Pričekaj provjeru rezultata.`
  if (state === 'ready') return `Pregledaj rezultat za korak: ${phaseLabel}.`
  if (state === 'blocked') return 'Dodaj traženi kontekst pa pokušaj ponovno.'
  if (state === 'failed') return 'Pokušaj ponovno ili nastavi ručno.'
  if (state === 'paused') return 'Nastavi tijek kada budeš spreman.'
  return `${phaseLabel} čeka svoj red.`
}

function humanize(value: string): string {
  const words = value.replace(/[_-]+/gu, ' ').trim().split(/\s+/u).filter(Boolean)
  if (words.length === 0) return 'Sljedeći korak'
  return words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ')
}

function statusLabel(status: string) {
  return ({ pending: 'Čeka', running: 'Radi', retrying: 'Popravak', verified: 'Provjereno', blocked: 'Blokirano', failed: 'Greška', paused: 'Pauzirano' } as Record<string, string>)[status] || 'Nije poznato'
}

function usageLabel(usage: AgenticTimelineStep['usage']) {
  if (!usage) return ''
  const input = Number(usage.input_tokens ?? usage.inputTokens ?? 0)
  const output = Number(usage.output_tokens ?? usage.outputTokens ?? 0)
  if (!input && !output) return ''
  return `Potrošnja ${input} + ${output}`
}
