'use client'

import { resolveNextAction, type NextAction } from '../../../lib/project/next-action'
import { createCompletionScan } from '../../../lib/project/completion-scan'
import { countDocumentWords } from '../../../lib/manuscript/model'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'
import type { AcademicContext } from '../../../lib/academic-context/types'
import { academicVisibilityForStatus } from '../../../lib/academic-context/visibility'
import { NextActionCard } from './next-action-card'
import { ProjectTimeline, type ProjectTimelineItem } from './project-timeline'
import { AgenticProcessPreview } from './agentic-process-preview'
import { resolveManuscriptProjectStage, type LifecycleLektaSummary } from '../../../lib/project/lifecycle-state'

const EMPTY_LEKTA_SUMMARY: LifecycleLektaSummary = { score: null, checkedAt: '', issues: [] }

export function ProjectHome({ manuscript, academicContext, passActive, syncStatus, lektaSummary = EMPTY_LEKTA_SUMMARY, onNavigate }: { manuscript: ManuscriptV1; academicContext?: AcademicContext | null; passActive: boolean; syncStatus: string; lektaSummary?: LifecycleLektaSummary; onNavigate: (destination: NextAction['destination']) => void }) {
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
    academicContext: academicContext || undefined,
  })
  const stage = resolveManuscriptProjectStage({ scanStage: scan.stage, totalWords, sections: manuscript.sections, lektaSummary })
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
        <div><span>Akademska pravila</span><b>{academicContext ? academicVisibilityForStatus(academicContext.status).label : 'Profil nije odabran'}</b><small>{academicContext ? `${academicContext.profileLabel}${academicContext.verifiedAt ? ` · ${academicContext.verifiedAt}` : ''}` : 'Opći način rada'}</small></div>
        <div><span>Cilj riječi</span><b>{academicContext?.wordRange ? formatRange(academicContext.wordRange.min, academicContext.wordRange.max) : 'Nije postavljen'}</b></div>
        <div><span>Citatni stil</span><b>{academicContext?.citationStyle || 'Provjeri s mentorom'}</b></div>
      </section>

      {academicContext && <p className="pis-academic-source-note">Status pravila: {academicContext.status}{academicContext.verifiedAt ? ` · provjereno ${academicContext.verifiedAt}` : ''}{academicContext.freshness?.isStale ? ' · provjera je starija od preporučenog roka' : ''}{academicContext.sources[0] ? <> · <a href={academicContext.sources[0].url} target="_blank" rel="noreferrer">{academicContext.sources[0].title}</a></> : ''}</p>}

      {academicContext?.sourcePlan && <section className="pis-academic-plan-summary" aria-label="Akademski plan izvora i metodologije">
        <div><b>Plan izvora</b><span>{academicContext.sourcePlan.minimumReferences ? `Najmanje ${academicContext.sourcePlan.minimumReferences} izvora` : 'Broj izvora nije zadan'}{academicContext.sourcePlan.minimumBooks ? ` · ${academicContext.sourcePlan.minimumBooks} knjige` : ''}</span></div>
        <div><b>Provjera izvora</b><span>{academicContext.sourcePlan.verification === 'verified_sources_required' ? 'Provjereni izvori obavezni' : academicContext.sourcePlan.verification === 'source_review_required' ? 'Izvore treba dodatno pregledati' : 'Opći način rada'}</span></div>
        <div><b>Metodološki plan</b><span>{academicContext.methodologyPlan?.required ? 'Profil traži metodološku provjeru' : 'Aktivira se ako rad uključuje istraživanje'}</span></div>
        {visibleV1AcademicCapabilities(academicContext.capabilities.aiCapabilities).length > 0 && <div><b>AI prema profilu</b><span>{visibleV1AcademicCapabilities(academicContext.capabilities.aiCapabilities).map(labelAcademicAiCapability).join(' · ')}</span></div>}
      </section>}

      <div className="pis-project-home-links">
        <button type="button" onClick={() => onNavigate('sources')}><b>Izvori i materijali</b><span>{hasMaterials ? 'Otvori lokalnu biblioteku projekta' : 'Dodaj literaturu, upute ili postojeći tekst'}</span></button>
        <button type="button" onClick={() => onNavigate('preparation')}><b>{passActive ? 'Pripremi projekt' : 'Pogledaj što dobivaš Passom'}</b><span>{passActive ? 'Materijali, izvori i agentični tijek' : 'Plan ostaje besplatan; plaćeni koraci se otključavaju za projekt'}</span></button>
        <div><b>{syncStatus === 'synced' ? 'Metapodaci sinkronizirani' : 'Rukopis je lokalno spremljen'}</b><span>Tekst ostaje na ovom uređaju</span></div>
      </div>

      {scan.missing.length > 0 && <p className="pis-project-home-note">Sljedeće još nedostaje: {scan.missing.join(', ')}.</p>}
    </section>
  )
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

function formatRange(min?: number, max?: number): string {
  const format = (value: number) => new Intl.NumberFormat('hr-HR').format(value)
  if (min !== undefined && max !== undefined) return `${format(min)}–${format(max)}`
  if (min !== undefined) return `najmanje ${format(min)}`
  return `najviše ${format(max || 0)}`
}

function labelAcademicAiCapability(value: string): string {
  return ({
    contextual_ai: 'Kontekstualna pomoć',
    section_writing: 'Pisanje po sekcijama',
    source_guidance: 'Vođenje izvora',
    methodology_guidance: 'Metodološko vođenje',
    research_design_guidance: 'Istraživački dizajn',
    web_research: 'Web istraživanje',
    autonomous_run: 'Autonomni tijek',
  } as Record<string, string>)[value] || value
}

function visibleV1AcademicCapabilities(values?: string[]): string[] {
  return [...new Set(values || [])]
}
