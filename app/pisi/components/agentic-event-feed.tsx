'use client'

import type { RunStudioEvent } from '../../../lib/agents/run-studio'
import { isSafeManuscriptHref } from '../../../lib/manuscript/links'

export function AgenticEventFeed({ events, onOpenSection }: { events: RunStudioEvent[]; onOpenSection?: (sectionId: string) => void }) {
  return (
    <section className="pis-agentic-event-feed" aria-labelledby="pis-agentic-event-feed-title">
      <header className="pis-agentic-section-heading">
        <div>
          <p className="pis-kicker">Što se događa</p>
          <h3 id="pis-agentic-event-feed-title">Dnevnik nastanka rada</h3>
        </div>
        <span>{events.length} događaja</span>
      </header>
      {events.length === 0 ? (
        <p className="pis-agentic-empty">Događaji će se pojaviti čim Katedra započne prvi korak.</p>
      ) : (
        <ol className="pis-agentic-event-list">
          {events.map((event) => <EventItem key={event.id} event={event} onOpenSection={onOpenSection} />)}
        </ol>
      )}
    </section>
  )
}

function EventItem({ event, onOpenSection }: { event: RunStudioEvent; onOpenSection?: (sectionId: string) => void }) {
  const actorLabel = event.actor === 'katedra' && event.status === 'active' ? 'Katedra radi' : event.actor === 'katedra' ? 'Katedra' : event.actor === 'verifier' ? 'Provjera' : 'Tijek rada'
  const statusLabel = ({ active: 'Radi', complete: 'Završeno', waiting: 'Čeka', warning: 'Pregled', blocked: 'Blokirano', failed: 'Greška' } as Record<string, string>)[event.status] || 'Status'

  return (
    <li className={`pis-agentic-event is-${event.status}`} data-event-kind={event.kind}>
      <div className="pis-agentic-event-marker" aria-hidden="true" />
      <div className="pis-agentic-event-body">
        <div className="pis-agentic-event-meta"><span>{actorLabel}</span><b>{statusLabel}</b>{event.attempt && <small>Pokušaj {event.attempt}/3</small>}</div>
        <h4>{event.title}</h4>
        <p>{event.summary}</p>
        {event.details && event.details.length > 0 && <ul className="pis-agentic-event-details">{event.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
        {event.sources && event.sources.length > 0 && <div className="pis-agentic-event-sources" aria-label="Izvori događaja">{event.sources.map((source) => <span key={source.id} className="pis-agentic-event-source"><b>{source.verified ? 'Provjereno' : 'Čeka provjeru'}</b>{source.url && isSafeManuscriptHref(source.url) ? <a href={source.url} target="_blank" rel="noreferrer">{source.url}</a> : <span>{source.title}</span>}</span>)}</div>}
        {event.sectionId && onOpenSection && <button type="button" className="pis-agentic-event-link" onClick={() => onOpenSection(event.sectionId as string)}>Otvori {event.title.includes('poglavlje') ? event.title.replace(/^.*poglavlje\s/u, '') : 'sekciju'} u rukopisu</button>}
      </div>
    </li>
  )
}
