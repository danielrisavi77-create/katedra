'use client'

import type { ReactNode } from 'react'

import { countDocumentWords, documentText } from '../../../lib/manuscript/model'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'
import type { AgenticWorkspacePhase } from '../../../lib/manuscript/workspace-view'

export function AgentStudioShell({ manuscript, passActive, phase, children, onOpenWriting }: {
  manuscript: ManuscriptV1
  passActive: boolean
  phase: AgenticWorkspacePhase
  children: ReactNode
  onOpenWriting?: () => void
}) {
  const totalWords = manuscript.sections.reduce((sum, section) => sum + countDocumentWords(section.content), 0)
  const activeSection = manuscript.sections.find((section) => section.id === manuscript.activeSectionId) || manuscript.sections[0]
  const activePreview = activeSection ? documentText(activeSection.content).slice(0, 360) : ''

  return (
    <section className="pis-agent-studio-shell" data-phase={phase} aria-labelledby="pis-agent-studio-title">
      <header className="pis-agent-studio-header">
        <div>
          <p className="pis-kicker">Katedra / radionica rada</p>
          <h1 id="pis-agent-studio-title">Radionica Katedre</h1>
          <p>Prati kako se rad priprema: od materijala i izvora do provjerenih poglavlja.</p>
        </div>
        <div className="pis-agent-studio-status">
          <span>{passActive ? 'Puni tijek dostupan' : 'Pregled procesa'}</span>
          <b>{phaseLabel(phase)}</b>
        </div>
      </header>

      <div className="pis-agent-studio-layout">
        <section className="pis-agent-studio-process" aria-label="Proces izrade rada">
          <div className="pis-agent-studio-message">
            <span className="pis-agent-studio-avatar" aria-hidden="true">K</span>
            <div>
              <b>Katedra</b>
              <p>Ovdje vidiš kako rad nastaje, što je provjereno i gdje je potrebna tvoja odluka. Rezultat ulazi u rukopis tek kada je potvrđen.</p>
            </div>
          </div>
          {children}
        </section>

        <aside className="pis-agent-studio-manuscript" aria-label="Rukopis uživo">
          <header>
            <div>
              <p className="pis-kicker">Canvas rukopisa</p>
              <h2>Rukopis uživo</h2>
            </div>
            <span>{totalWords.toLocaleString('hr-HR')} riječi</span>
          </header>

          <ol className="pis-agent-studio-outline" aria-label="Outline rada">
            {manuscript.sections.map((section) => (
              <li key={section.id} data-active={section.id === activeSection?.id ? 'true' : 'false'}>
                <span>{String(section.order + 1).padStart(2, '0')}</span>
                <b>{section.title}</b>
                <em>{statusLabel(section.status)}</em>
              </li>
            ))}
          </ol>

          <div className="pis-agent-studio-paper">
            <p className="pis-kicker">Aktivna sekcija</p>
            <h3>{activeSection?.title || 'Nema aktivne sekcije'}</h3>
            <p>{activePreview || 'Tekst će se pojaviti ovdje kada započneš pisati.'}</p>
          </div>

          {onOpenWriting && <button type="button" className="pis-agent-studio-open-writing" onClick={onOpenWriting}>Otvori rukopis <span aria-hidden="true">→</span></button>}
        </aside>
      </div>
    </section>
  )
}

function phaseLabel(phase: AgenticWorkspacePhase): string {
  return ({ preparation: 'Priprema', dashboard: 'Tijek u radu', intervention: 'Čeka kontekst', review: 'Pregled rezultata' } as Record<AgenticWorkspacePhase, string>)[phase]
}

function statusLabel(status: ManuscriptV1['sections'][number]['status']): string {
  return ({ empty: 'Prazno', draft: 'Nacrt', review: 'Pregled', approved: 'Odobreno' } as Record<typeof status, string>)[status]
}
