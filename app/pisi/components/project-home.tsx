'use client'

import { createCompletionScan } from '../../../lib/project/completion-scan'
import { countDocumentWords } from '../../../lib/manuscript/model'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'

export function ProjectHome({ manuscript, passActive, syncStatus, onContinueWriting, onPrepare, onOpenTools }: { manuscript: ManuscriptV1; passActive: boolean; syncStatus: string; onContinueWriting: () => void; onPrepare: () => void; onOpenTools: () => void }) {
  const totalWords = manuscript.sections.reduce((sum, section) => sum + countDocumentWords(section.content), 0)
  const scan = createCompletionScan({
    startMode: totalWords > 0 ? 'existing' : 'new',
    currentState: manuscript.meta.currentState || (totalWords > 0 ? 'draft' : 'topic'),
    title: manuscript.title,
    importedText: totalWords > 0 ? 'local draft' : '',
    mentor: manuscript.meta.mentor || '',
    deadline: manuscript.meta.deadline || '',
    materials: manuscript.meta.materials || [],
  })

  return (
    <section className="pis-project-home" aria-labelledby="project-home-title">
      <header className="pis-project-home-header">
        <div>
          <p className="pis-kicker">Projektna radionica</p>
          <h1 id="project-home-title">{manuscript.title || 'Rad bez naslova'}</h1>
          <p>{manuscript.meta.institution || 'Fakultet nije odabran'}{manuscript.meta.program ? ` · ${manuscript.meta.program}` : ''}</p>
        </div>
        <span className="pis-project-stage">{stageLabel(scan.stage)}</span>
      </header>

      <div className="pis-project-home-grid">
        <section className="pis-next-action-card" aria-labelledby="next-action-title">
          <p className="pis-kicker">Tvoj sljedeći korak</p>
          <h2 id="next-action-title">{scan.nextActions[0]}</h2>
          <p>{scan.missing.length ? `Nedostaje: ${scan.missing[0]}.` : 'Projekt ima dovoljno konteksta za nastavak rada.'}</p>
          <button type="button" className="pis-primary-button" onClick={onContinueWriting}>Nastavi pisati →</button>
        </section>

        <section className="pis-project-timeline" aria-labelledby="project-timeline-title">
          <div className="pis-section-heading"><div><p className="pis-kicker">Put rada</p><h2 id="project-timeline-title">Od teme do predaje</h2></div><span>{totalWords.toLocaleString('hr-HR')} riječi</span></div>
          <ol>
            {['Tema', 'Plan', 'Pisanje', 'Revizija', 'Lekta', 'Predaja'].map((label, index) => <li key={label} data-active={index <= activeIndex(scan.stage) ? 'true' : 'false'}><i aria-hidden="true" />{label}</li>)}
          </ol>
        </section>
      </div>

      <div className="pis-project-home-links">
        <button type="button" onClick={onPrepare}><b>{passActive ? 'Pripremi projekt' : 'Pogledaj što dobivaš Passom'}</b><span>{passActive ? 'Materijali, izvori i agenticni tijek' : 'Plan ostaje besplatan; pisanje se otključava za projekt'}</span></button>
        <button type="button" onClick={onOpenTools}><b>Projektni alati</b><span>Izvori, mentor, pravila i Lekta</span></button>
        <div><b>{syncStatus === 'synced' ? 'Metapodaci sinkronizirani' : 'Rukopis je lokalno spremljen'}</b><span>Tekst ostaje na ovom uređaju</span></div>
      </div>
    </section>
  )
}

function stageLabel(stage: string) {
  return ({ started: 'Početak', scanned: 'Procjena', planned: 'Plan', researching: 'Istraživanje', writing: 'Pisanje', review: 'Revizija' } as Record<string, string>)[stage] || 'Projekt'
}

function activeIndex(stage: string) {
  return ({ started: 0, scanned: 0, planned: 1, researching: 2, writing: 2, review: 3, lekta: 4, completed: 5 } as Record<string, number>)[stage] ?? 0
}
