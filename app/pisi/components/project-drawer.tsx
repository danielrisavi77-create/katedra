'use client'

import { useState } from 'react'

import type { ManuscriptSourceV1, ManuscriptV1 } from '../../../lib/manuscript/types'
import type { AgenticDraftV1 } from '../../../lib/manuscript/agentic-revisions'
import type { LektaWorkspaceSummary } from './workspace-client'
import { FocusTrap } from './focus-trap'
import { PaidProjectSetup } from './paid-project-setup'
import type { ProjectDrawerTab } from './project-navigation-routing'

type LocalHistoryEntry = { occurredAt: string; action: string; sectionId: string }

export function ProjectDrawer({
  open,
  manuscript,
  legacyChecks,
  mentorTasks,
  lektaSummary,
  passActive,
  onClose,
  onMetaChange,
  onAddSource,
  onRemoveSource,
  onAddMentorTask,
  onToggleMentorTask,
  onBackup,
  onRestore,
  onImportText,
  onAcceptDraft,
  requestedTab,
  onTabChange,
  historyEntries = [],
}: {
  open: boolean
  manuscript: ManuscriptV1
  legacyChecks: Record<string, boolean>
  mentorTasks: Array<{ id: string; text: string; done: boolean; sectionId?: string }>
  lektaSummary: LektaWorkspaceSummary
  passActive: boolean
  onClose: () => void
  onMetaChange: (field: keyof ManuscriptV1['meta'], value: string) => void
  onAddSource: (source: ManuscriptSourceV1) => void
  onRemoveSource: (id: string) => void
  onAddMentorTask: (text: string) => void
  onToggleMentorTask: (id: string) => void
  onBackup: () => void
  onRestore: (file: File) => void
  onImportText: (file: File) => void
  onAcceptDraft?: (draft: AgenticDraftV1, sectionIds?: string[]) => Promise<boolean>
  requestedTab?: ProjectDrawerTab
  onTabChange?: (tab: ProjectDrawerTab) => void
  historyEntries?: LocalHistoryEntry[]
}) {
  const requestedDrawerTab = requestedTab === 'defense' && manuscript.workType === 's' ? 'plan' : requestedTab
  const [uncontrolledTab, setUncontrolledTab] = useState<ProjectDrawerTab>(requestedDrawerTab || 'plan')
  const tab = requestedDrawerTab || uncontrolledTab
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [mentorText, setMentorText] = useState('')
  const completedLegacy = Object.values(legacyChecks).filter(Boolean).length

  const selectTab = (nextTab: ProjectDrawerTab) => {
    setUncontrolledTab(nextTab)
    onTabChange?.(nextTab)
  }

  if (!open) return null

  const addSource = () => {
    if (!sourceTitle.trim()) return
    onAddSource({
      id: `source-${crypto.randomUUID?.() || Date.now().toString(36)}`,
      title: sourceTitle.trim(),
      urlOrDoi: sourceUrl.trim() || undefined,
      verified: false,
    })
    setSourceTitle('')
    setSourceUrl('')
  }

  return (
    <div className="pis-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <FocusTrap onEscape={onClose}>
      <aside className="pis-project-drawer" role="dialog" aria-modal="true" aria-labelledby="project-drawer-title" aria-describedby="project-drawer-description">
        <header>
          <div><p>Projektni alati</p><h2 id="project-drawer-title">{manuscript.title || 'Rad bez naslova'}</h2><span id="project-drawer-description" className="sr-only">Alati i postavke za ovaj rukopis.</span></div>
          <button type="button" onClick={onClose} aria-label="Zatvori projektne alate">×</button>
        </header>
        <nav aria-label="Projektni alati">
          {([
            ['plan', 'Plan'], ['sources', 'Literatura'], ['mentor', 'Mentor'],
            ['rules', 'Pravila'], ['lekta', 'Lekta'], ['help', 'Pomoć'],
          ] as const).map(([value, label]) => <button type="button" key={value} className={tab === value ? 'is-active' : ''} onClick={() => selectTab(value)}>{label}</button>)}
          <button type="button" className={tab === 'history' ? 'is-active' : ''} onClick={() => selectTab('history')}>Povijest</button>
          {manuscript.workType !== 's' && <button type="button" className={tab === 'defense' ? 'is-active' : ''} onClick={() => selectTab('defense')}>Obrana</button>}
        </nav>

        <div className="pis-drawer-content">
          {tab === 'plan' && (
            <section>
              <p className="pis-kicker">Plan i zadaci</p>
              <h3>Jedan jasan sljedeći korak.</h3>
              <div className="pis-next-action"><span>→</span><b>{nextProjectAction(manuscript)}</b></div>
              <dl className="pis-project-facts">
                <div><dt>Aktivna faza</dt><dd>{projectStage(manuscript)}</dd></div>
                <div><dt>Sekcije za pregled</dt><dd>{manuscript.sections.filter((section) => section.status === 'review').length}</dd></div>
                <div><dt>Stari procesni koraci</dt><dd>{completedLegacy} evidentirano</dd></div>
                <div><dt>Otvoreni mentorovi zadaci</dt><dd>{mentorTasks.filter((task) => !task.done).length}</dd></div>
              </dl>
              <div className="pis-backup-actions">
                <label>Uvezi .txt/.md<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportText(file); event.currentTarget.value = '' }} /></label>
                <button type="button" onClick={onBackup}>Spremi lokalni backup (.json)</button>
                <label>Vrati backup<input type="file" accept=".json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onRestore(file) }} /></label>
              </div>
            </section>
          )}

          {tab === 'agents' && <PaidProjectSetup projectId={manuscript.projectId} passActive={passActive} sectionIds={manuscript.sections.map((section) => section.id)} manuscript={manuscript} onAcceptDraft={onAcceptDraft} />}

          {tab === 'sources' && (
            <section>
              <p className="pis-kicker">Lokalna biblioteka</p><h3>Literatura uz rukopis.</h3>
              <div className="pis-inline-form"><input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Naslov izvora" /><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="DOI ili poveznica" /><button type="button" onClick={addSource}>Dodaj</button></div>
              <ul className="pis-tool-list">
                {manuscript.sources.map((source) => <li key={source.id}><div><b>{source.title}</b><small>{source.urlOrDoi || 'Bez poveznice'} · {source.verified ? 'Identitet izvora provjeren' : 'provjeri prije uporabe'}</small></div><button type="button" onClick={() => onRemoveSource(source.id)}>Ukloni</button></li>)}
                {!manuscript.sources.length && <li className="is-empty">Još nema dodanih izvora.</li>}
              </ul>
            </section>
          )}

          {tab === 'mentor' && (
            <section>
              <p className="pis-kicker">Povratne informacije</p><h3>Komentar postaje zadatak.</h3>
              <form className="pis-inline-form" onSubmit={(event) => { event.preventDefault(); if (mentorText.trim()) { onAddMentorTask(mentorText.trim()); setMentorText('') } }}><input value={mentorText} onChange={(event) => setMentorText(event.target.value)} placeholder="npr. Uvod treba jasniju tezu" /><button type="submit">Dodaj</button></form>
              <ul className="pis-tool-list">
                {mentorTasks.map((task) => <li key={task.id} className={task.done ? 'is-done' : ''}><label><input type="checkbox" checked={task.done} onChange={() => onToggleMentorTask(task.id)} /><span>{task.text}</span></label></li>)}
                {!mentorTasks.length && <li className="is-empty">Nema otvorenih mentorovih komentara.</li>}
              </ul>
            </section>
          )}

          {tab === 'rules' && (
            <section>
              <p className="pis-kicker">Pravila projekta</p><h3>Okvir koji Katedra koristi.</h3>
              <div className="pis-meta-form">
                <label>Fakultet<input value={manuscript.meta.institution || ''} onChange={(event) => onMetaChange('institution', event.target.value)} /></label>
                <label>Mentor<input value={manuscript.meta.mentor || ''} onChange={(event) => onMetaChange('mentor', event.target.value)} /></label>
                <label>Citatni stil<input value={manuscript.meta.citationStyle || ''} onChange={(event) => onMetaChange('citationStyle', event.target.value)} /></label>
                <label>Rok<input type="date" value={manuscript.meta.deadline || ''} onChange={(event) => onMetaChange('deadline', event.target.value)} /></label>
              </div>
              <p className="pis-boundary-note">Katedra ova pravila koristi za coaching. Samo Lekta provjerava postoji li tehnička usklađenost u stvarnom DOCX dokumentu.</p>
            </section>
          )}

          {tab === 'lekta' && (
            <section>
              <p className="pis-kicker">Provjeri prije predaje</p><h3>Tehnička provjera ostaje u Lekti.</h3>
              <div className="pis-lekta-status">
                <span>{lektaSummary.checkedAt ? `Zadnja provjera ${formatLektaDate(lektaSummary.checkedAt)}` : manuscript.meta.unitId ? 'Profil povezan' : 'Profil još nije odabran'}</span>
                <b>{lektaSummary.score === null ? 'DOCX nije tehnički verificiran u Katedri.' : `Lekta rezultat: ${lektaSummary.score}/100 · ${lektaSummary.issues.length} otvorenih nalaza`}</b>
              </div>
              {lektaSummary.issues.length > 0 && <ul className="pis-lekta-findings">{lektaSummary.issues.slice(0, 6).map((issue) => <li key={issue.id} data-severity={issue.severity}><span>{issue.severity === 'error' ? 'Kritično' : issue.severity === 'warning' ? 'Upozorenje' : 'Napomena'}</span><b>{issue.label || issue.id}</b></li>)}</ul>}
              {lektaSummary.fixedTotal > 0 && <p className="pis-lekta-fixed">Lekta je potvrdila {lektaSummary.fixedTotal} ranije riješenih nalaza.</p>}
              <a className="pis-primary-link" href={lektaUrl(manuscript)} target="_blank" rel="noopener">Otvori projekt u Lekti ↗</a>
              <p className="pis-boundary-note">Lekta provjerava font, margine, strukturu dokumenta, citatnu mehaniku i formalna pravila. Katedra pomaže riješiti sadržajne posljedice nalaza.</p>
            </section>
          )}

          {tab === 'history' && (
            <section>
              <p className="pis-kicker">Samo na ovom uređaju</p><h3>Lokalna povijest projekta</h3>
              <p className="pis-boundary-note">Ovdje su samo lokalno evidentirane prihvaćene promjene. Tekst rukopisa ne odlazi u povijest projekta.</p>
              {historyEntries.length > 0 ? <ul className="pis-tool-list">{historyEntries.map((entry) => <li key={`${entry.occurredAt}:${entry.sectionId}`}><div><b>{entry.action}</b><small>{entry.occurredAt} · sekcija {entry.sectionId}</small></div></li>)}</ul> : <p className="pis-boundary-note">Još nema lokalno evidentiranih promjena.</p>}
            </section>
          )}

          {tab === 'defense' && manuscript.workType !== 's' && (
            <section>
              <p className="pis-kicker">Priprema obrane</p><h3>Pripremi obranu iz svog rada.</h3>
              <p className="pis-boundary-note">Katedra ovdje ne procjenjuje ishod obrane. Koristi lokalne podatke projekta da pripremiš temu, argumente i pitanja za mentora.</p>
              <dl className="pis-project-facts">
                <div><dt>Rok projekta</dt><dd>{manuscript.meta.deadline || 'Nije postavljen'}</dd></div>
                <div><dt>Mentorovi zadaci</dt><dd>{mentorTasks.filter((task) => !task.done).length} otvoreno</dd></div>
                <div><dt>Sekcije rukopisa</dt><dd>{manuscript.sections.length}</dd></div>
              </dl>
            </section>
          )}

          {tab === 'help' && (
            <section>
              <p className="pis-kicker">Kako radi</p><h3>Pišeš ti. Katedra uređuje uz tvoju potvrdu.</h3>
              <ol className="pis-help-steps"><li><b>Piši u sredini.</b><span>Svako poglavlje ima vlastiti prostor i lokalnu verziju.</span></li><li><b>Označi tekst.</b><span>U chatu Katedra dobiva aktivnu sekciju ili označeni dio, uz strukturu rada, naslove izvora i dodane materijale.</span></li><li><b>Pregledaj prijedlog.</b><span>Ništa ne ulazi u rukopis dok ne odabereš Prihvati.</span></li><li><b>Izvezi i provjeri.</b><span>DOCX otvori u Wordu i provjeri u Lekti.</span></li></ol>
            </section>
          )}
        </div>
      </aside>
      </FocusTrap>
    </div>
  )
}

export function lektaUrl(manuscript: ManuscriptV1): string {
  const params = new URLSearchParams({ project: manuscript.projectId })
  if (manuscript.meta.unitId) params.set('unit', manuscript.meta.unitId)
  params.set('work', manuscript.workType === 's' ? 'seminarski' : manuscript.workType === 'd' ? 'diplomski' : 'zavrsni')
  return `https://lektahr.netlify.app/?${params}`
}

function projectStage(manuscript: ManuscriptV1): string {
  if (manuscript.sections.every((section) => section.status === 'approved')) return 'Predaja'
  if (manuscript.sections.some((section) => section.status === 'review')) return 'Recenzija'
  if (manuscript.sections.some((section) => section.status !== 'empty')) return 'Pisanje'
  return 'Plan'
}

function nextProjectAction(manuscript: ManuscriptV1): string {
  const empty = manuscript.sections.find((section) => section.status === 'empty')
  if (empty) return `Napravi nacrt sekcije „${empty.title}”.`
  const draft = manuscript.sections.find((section) => section.status === 'draft')
  if (draft) return `Pregledaj argument i izvore u sekciji „${draft.title}”.`
  return 'Izvezi DOCX i pokreni Lekta provjeru.'
}

function formatLektaDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium' }).format(date)
}
