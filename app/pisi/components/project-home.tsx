'use client'

import { resolveNextAction, type NextAction } from '../../../lib/project/next-action'
import { createCompletionScan } from '../../../lib/project/completion-scan'
import { countDocumentWords } from '../../../lib/manuscript/model'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'
import { NextActionCard } from './next-action-card'
import { ProjectTimeline, type ProjectTimelineItem } from './project-timeline'
import { AgenticProcessPreview } from './agentic-process-preview'

export function ProjectHome({ manuscript, passActive, syncStatus, onNavigate }: { manuscript: ManuscriptV1; passActive: boolean; syncStatus: string; onNavigate: (destination: NextAction['destination']) => void }) {
  const totalWords = manuscript.sections.reduce((sum, section) => sum + countDocumentWords(section.content), 0)
  const reviewSectionCount = manuscript.sections.filter((section) => section.status === 'review').length
  const materials = [
    ...(manuscript.meta.materials || []),
    ...manuscript.sources.map((source) => source.title),
  ]
  const hasMaterials = materials.length > 0
  const scan = createCompletionScan({
    startMode: totalWords > 0 ? 'existing' : 'new',
    currentState: manuscript.meta.currentState || (totalWords > 0 ? 'draft' : 'topic'),
    title: manuscript.title,
    importedText: totalWords > 0 ? 'local draft' : '',
    mentor: manuscript.meta.mentor || '',
    deadline: manuscript.meta.deadline || '',
    materials,
  })
  const stage = projectStage(scan.stage, totalWords, reviewSectionCount)
  const action = resolveNextAction({
    stage,
    totalWords,
    sectionCount: manuscript.sections.length,
    reviewSectionCount,
    hasMaterials,
    passActive,
  })

  return (
    <section className="pis-project-home" aria-labelledby="project-home-title">
      <header className="pis-project-home-header">
        <div>
          <p className="pis-kicker">Projektna radionica</p>
          <h1 id="project-home-title">{manuscript.title || 'Rad bez naslova'}</h1>
          <p>{manuscript.meta.institution || 'Fakultet nije odabran'}{manuscript.meta.program ? ` · ${manuscript.meta.program}` : ''}</p>
        </div>
        <span className="pis-project-stage">{stageLabel(stage)}</span>
      </header>

      <div className="pis-project-home-grid">
        <NextActionCard action={action} onNavigate={onNavigate} />
        <ProjectTimeline items={timelineItems(stage)} totalWords={totalWords} />
      </div>

      <AgenticProcessPreview mode="guided" sourcePolicy="uploaded_only" />

      <section className="pis-project-home-summary" aria-label="Sažetak projekta">
        <div><span>Materijali</span><b>{hasMaterials ? `${materials.length} ${materials.length === 1 ? 'zapis' : 'zapisa'}` : 'Nisu dodani'}</b></div>
        <div><span>Rok</span><b>{manuscript.meta.deadline || 'Nije postavljen'}</b></div>
        <div><span>Mentor</span><b>{manuscript.meta.mentor || 'Nije dodan'}</b></div>
        <div><span>Pass</span><b>{passActive ? 'Aktivan za ovaj projekt' : 'Nije aktivan'}</b></div>
        <div><span>Lekta</span><b>{manuscript.meta.unitId ? 'Profil povezan' : 'Profil nije odabran'}</b></div>
      </section>

      <div className="pis-project-home-links">
        <button type="button" onClick={() => onNavigate('sources')}><b>Izvori i materijali</b><span>{hasMaterials ? 'Otvori lokalnu biblioteku projekta' : 'Dodaj literaturu, upute ili postojeći tekst'}</span></button>
        <button type="button" onClick={() => onNavigate('preparation')}><b>{passActive ? 'Pripremi projekt' : 'Pogledaj što dobivaš Passom'}</b><span>{passActive ? 'Materijali, izvori i agentični tijek' : 'Plan ostaje besplatan; plaćeni koraci se otključavaju za projekt'}</span></button>
        <div><b>{syncStatus === 'synced' ? 'Metapodaci sinkronizirani' : 'Rukopis je lokalno spremljen'}</b><span>Tekst ostaje na ovom uređaju</span></div>
      </div>

      {scan.missing.length > 0 && <p className="pis-project-home-note">Sljedeće još nedostaje: {scan.missing.join(', ')}.</p>}
    </section>
  )
}

function projectStage(scanStage: string, totalWords: number, reviewSectionCount: number): string {
  if (reviewSectionCount > 0) return 'review'
  if (totalWords > 0) return 'writing'
  return scanStage
}

function stageLabel(stage: string) {
  return ({ started: 'Početak', scanned: 'Procjena', planned: 'Plan', researching: 'Istraživanje', writing: 'Pisanje', review: 'Revizija', lekta: 'Lekta', completed: 'Predaja' } as Record<string, string>)[stage] || 'Projekt'
}

function timelineItems(stage: string): ProjectTimelineItem[] {
  const stages = [
    ['topic', 'Tema'], ['plan', 'Plan'], ['literature', 'Literatura'], ['writing', 'Pisanje'], ['review', 'Revizija'], ['lekta', 'Lekta'], ['submission', 'Predaja'],
  ] as const
  const active = ({ started: 0, scanned: 0, planned: 1, researching: 2, writing: 3, review: 4, lekta: 5, completed: 6 } as Record<string, number>)[stage] ?? 0
  return stages.map(([id, label], index) => ({ id, label, state: index < active ? 'complete' : index === active ? 'active' : 'upcoming' }))
}
