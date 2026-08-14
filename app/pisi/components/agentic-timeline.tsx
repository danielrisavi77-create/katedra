'use client'

export interface AgenticTimelineStep {
  id: string
  agent: string
  verifier: string
  status: string
  attempt: number
  lastVerification?: { issues?: Array<{ message?: string }> }
}

export function AgenticTimeline({ steps }: { steps: AgenticTimelineStep[] }) {
  return (
    <section className="pis-agentic-timeline" aria-labelledby="pis-agentic-timeline-title">
      <header className="pis-agentic-section-heading"><div><p className="pis-kicker">Tim rada</p><h3 id="pis-agentic-timeline-title">Agent za agentom</h3></div><span>{steps.filter((step) => step.status === 'verified').length}/{steps.length || 0} provjereno</span></header>
      <ol className="pis-agentic-timeline-list">
        {steps.map((step) => {
          const issue = step.lastVerification?.issues?.find((item) => item.message)?.message
          return <li key={step.id} data-status={step.status}>
            <span className="pis-timeline-marker" aria-hidden="true">{step.status === 'verified' ? '✓' : step.status === 'blocked' ? '!' : step.status === 'running' || step.status === 'retrying' ? '→' : '·'}</span>
            <div className="pis-timeline-step-copy"><b>{label(step.agent)}</b><small>Verifikator: {label(step.verifier)} · Pokušaj {step.attempt}/3</small>{issue && <p>{issue}</p>}</div>
            <em>{statusLabel(step.status)}</em>
          </li>
        })}
      </ol>
    </section>
  )
}

function label(value: string) {
  return value.replace(/_verifier$/u, ' verifikator').replace(/(^|[ _-])([a-z])/gu, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
}

function statusLabel(status: string) {
  return ({ pending: 'Čeka', running: 'Radi', retrying: 'Popravak', verified: 'Provjereno', blocked: 'Blokirano', failed: 'Greška' } as Record<string, string>)[status] || 'Nepoznato'
}
