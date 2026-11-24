'use client'

import { useState } from 'react'

import type { ManuscriptSnapshotV1, ManuscriptSourceV1, ManuscriptV1 } from '../../../lib/manuscript/types'
import { verifyManuscriptSource } from '../../../lib/manuscript/source-verification'
import type { AcademicContext } from '../../../lib/academic-context/types'
import { academicVisibilityForStatus } from '../../../lib/academic-context/visibility'
import { academicHandoffParams } from '../../../lib/academic-context/presentation'
import type { AgenticDraftV1 } from '../../../lib/manuscript/agentic-revisions'
import type { ManuscriptAiLedgerEntry } from '../../../lib/manuscript/ai-ledger'
import { aiLedgerExportText } from '../../../lib/manuscript/ai-ledger'
import { countDocumentWords } from '../../../lib/manuscript/model'
import { changeKindLabel, compareManuscripts, snapshotChangeKind } from '../../../lib/manuscript/version-browser'
import type { VersionRestoreTarget } from '../../../lib/manuscript/version-browser'
import type { LektaWorkspaceSummary } from './workspace-client'
import type { ResearchPlanAccess } from '../../../lib/research-plan/access'
import type { ResearchPlanStatus, ResearchPlanV1 } from '../../../lib/research-plan/types'
import { FocusTrap } from './focus-trap'
import { PaidProjectSetup } from './paid-project-setup'
import type { ProjectDrawerTab } from './project-navigation-routing'
import { isCleanLektaResult, resolveManuscriptProjectStage } from '../../../lib/project/lifecycle-state'
import { researchPlanTabVisible } from '../../../lib/research-plan/access'
import { ResearchPlanPanel } from './research-plan-panel'

type LocalHistoryEntry = { occurredAt: string; action: string; sectionId: string }

export function ProjectDrawer({
  open,
  manuscript,
  legacyChecks,
  mentorTasks,
  lektaSummary,
  passActive,
  academicContext,
  researchPlan,
  researchPlanAccess,
  researchPlanSnapshots = [],
  researchPlanStorageStatus = 'saved',
  onClose,
  onMetaChange,
  onAddSource,
  onRemoveSource,
  onUpdateSource,
  onAddMentorTask,
  onToggleMentorTask,
  onBackup,
  onRestore,
  onImportText,
  onAcceptDraft,
  requestedTab,
  onTabChange,
  historyEntries = [],
  versionEntries = [],
  onRestoreVersion,
  onRecordVersion,
  aiLedgerEntries = [],
  onLektaHandoff,
  onResearchPlanChange,
  onResearchPlanTransition,
  onResearchPlanSnapshot,
  onRestoreResearchPlan,
}: {
  open: boolean
  manuscript: ManuscriptV1
  legacyChecks: Record<string, boolean>
  mentorTasks: Array<{ id: string; text: string; done: boolean; sectionId?: string }>
  lektaSummary: LektaWorkspaceSummary
  passActive: boolean
  academicContext?: AcademicContext | null
  researchPlan?: ResearchPlanV1 | null
  researchPlanAccess?: ResearchPlanAccess | null
  researchPlanSnapshots?: Array<{ id: string; reason: string; createdAt: string }>
  researchPlanStorageStatus?: 'saving' | 'saved' | 'error'
  onClose: () => void
  onMetaChange: (field: keyof ManuscriptV1['meta'], value: string) => void
  onAddSource: (source: ManuscriptSourceV1) => void
  onRemoveSource: (id: string) => void
  onUpdateSource?: (source: ManuscriptSourceV1) => void
  onAddMentorTask: (text: string) => void
  onToggleMentorTask: (id: string) => void
  onBackup: () => void
  onRestore: (file: File) => void
  onImportText: (file: File) => void
  onAcceptDraft?: (draft: AgenticDraftV1, sectionIds?: string[]) => Promise<boolean>
  requestedTab?: ProjectDrawerTab
  onTabChange?: (tab: ProjectDrawerTab) => void
  historyEntries?: LocalHistoryEntry[]
  versionEntries?: ManuscriptSnapshotV1[]
  onRestoreVersion?: (snapshot: ManuscriptSnapshotV1, sectionId?: string, target?: VersionRestoreTarget) => void
  onRecordVersion?: () => void
  aiLedgerEntries?: ManuscriptAiLedgerEntry[]
  onLektaHandoff?: () => void
  onResearchPlanChange?: (plan: ResearchPlanV1) => void
  onResearchPlanTransition?: (status: ResearchPlanStatus) => void
  onResearchPlanSnapshot?: (reason: string) => void
  onRestoreResearchPlan?: (snapshotId: string) => void
}) {
  const requestedDrawerTab = requestedTab === 'defense' ? 'plan' : requestedTab
  const [uncontrolledTab, setUncontrolledTab] = useState<ProjectDrawerTab>(requestedDrawerTab || 'plan')
  const researchAvailable = researchPlanTabVisible(researchPlanAccess)
  const tab = requestedDrawerTab === 'research' && !researchAvailable ? 'plan' : requestedDrawerTab || uncontrolledTab
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [verifyingSourceId, setVerifyingSourceId] = useState<string | null>(null)
  const [sourceVerificationError, setSourceVerificationError] = useState('')
  const [mentorText, setMentorText] = useState('')
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
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

  const verifySource = async (source: ManuscriptSourceV1) => {
    if (!onUpdateSource) return
    setVerifyingSourceId(source.id)
    setSourceVerificationError('')
    try {
      onUpdateSource(await verifyManuscriptSource(source))
    } catch {
      setSourceVerificationError('Provjera izvora trenutačno nije uspjela. Pokušaj ponovno.')
    } finally {
      setVerifyingSourceId(null)
    }
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
            ['rules', 'Pravila'], ...(researchAvailable ? [['research', 'Istraživački plan'] as const] : []), ['lekta', 'Lekta'], ['help', 'Pomoć'],
          ] as const).map(([value, label]) => <button type="button" key={value} className={tab === value ? 'is-active' : ''} onClick={() => selectTab(value)}>{label}</button>)}
          <button type="button" className={tab === 'history' ? 'is-active' : ''} onClick={() => selectTab('history')}>Povijest</button>
        </nav>

        <div className="pis-drawer-content">
          {tab === 'plan' && (
            <section>
              <p className="pis-kicker">Plan i zadaci</p>
              <h3>Jedan jasan sljedeći korak.</h3>
              <div className="pis-next-action"><span>→</span><b>{nextProjectAction(manuscript, lektaSummary)}</b></div>
              <dl className="pis-project-facts">
                <div><dt>Aktivna faza</dt><dd>{projectStage(manuscript, lektaSummary)}</dd></div>
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

          {tab === 'research' && researchPlan && onResearchPlanChange && onResearchPlanTransition && <ResearchPlanPanel plan={researchPlan} onChange={onResearchPlanChange} onTransition={onResearchPlanTransition} onSnapshot={onResearchPlanSnapshot} snapshots={researchPlanSnapshots} onRestore={onRestoreResearchPlan} storageStatus={researchPlanStorageStatus} />}

          {tab === 'sources' && (
            <section>
              <p className="pis-kicker">Lokalna biblioteka</p><h3>Literatura uz rukopis.</h3>
              <div className="pis-inline-form"><input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Naslov izvora" /><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="DOI ili poveznica" /><button type="button" onClick={addSource}>Dodaj</button></div>
              {sourceVerificationError && <p className="pis-boundary-note" role="alert">{sourceVerificationError}</p>}
              <ul className="pis-tool-list">
                {manuscript.sources.map((source) => {
                  const status = source.verification?.status || 'needs_review'
                  const statusLabel = status === 'verified' ? 'Identitet izvora provjeren' : status === 'blocked' ? 'Izvor je blokiran' : 'Potrebna je ručna provjera'
                  return <li key={source.id}><div><b>{source.title}</b><small>{source.urlOrDoi || 'Bez poveznice'} · {statusLabel}</small></div><div className="pis-tool-actions"><button type="button" onClick={() => void verifySource(source)} disabled={!onUpdateSource || verifyingSourceId === source.id}>{verifyingSourceId === source.id ? 'Provjeravam…' : 'Provjeri izvor'}</button><button type="button" onClick={() => onRemoveSource(source.id)}>Ukloni</button></div></li>
                })}
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
                <label>Mentor<input value={manuscript.meta.mentor || ''} onChange={(event) => onMetaChange('mentor', event.target.value)} /></label>
                <label>Rok<input type="date" value={manuscript.meta.deadline || ''} onChange={(event) => onMetaChange('deadline', event.target.value)} /></label>
              </div>
              {academicContext ? (
                <div className="pis-academic-rules" aria-label={`Akademska pravila — ${academicVisibilityForStatus(academicContext.status).label}`}>
                  <div className="pis-academic-rules-heading">
                    <div><b>{academicContext.profileLabel}</b><span>{academicContext.institutionName}</span></div>
                    <strong data-status={academicContext.status}>{academicVisibilityForStatus(academicContext.status).label}</strong>
                  </div>
                  <p className="pis-boundary-note">{academicContext.verifiedAt ? `Provjereno ${academicContext.verifiedAt}.` : 'Datum provjere nije naveden.'}{academicContext.freshness?.isStale ? ' Provjera je starija od preporučenog roka; provjeri aktualne upute.' : ''}</p>
                  <dl className="pis-project-facts">
                    {academicContext.wordRange && <div><dt>Cilj riječi</dt><dd>{formatRange(academicContext.wordRange.min, academicContext.wordRange.max)}</dd></div>}
                    {academicContext.minimumReferences !== undefined && <div><dt>Minimalno izvora</dt><dd>{academicContext.minimumReferences}</dd></div>}
                    {academicContext.minimumBooks !== undefined && <div><dt>Minimalno knjiga</dt><dd>{academicContext.minimumBooks}</dd></div>}
                    {academicContext.citationStyle && <div><dt>Citatni stil</dt><dd>{academicContext.citationStyle}</dd></div>}
                    {academicContext.formatting?.font && <div><dt>Font</dt><dd>{academicContext.formatting.font}</dd></div>}
                    {academicContext.formatting?.fontSize !== undefined && <div><dt>Veličina fonta</dt><dd>{formatNumber(academicContext.formatting.fontSize)} pt</dd></div>}
                    {academicContext.formatting?.lineSpacing !== undefined && <div><dt>Prored</dt><dd>{formatNumber(academicContext.formatting.lineSpacing)}</dd></div>}
                  </dl>
                  {academicContext.requiredSections.length > 0 && <div><b>Obvezne sekcije</b><ul className="pis-rule-list">{academicContext.requiredSections.slice(0, 12).map((item) => <li key={item}>{item}</li>)}</ul></div>}
                  {academicContext.manualChecks.length > 0 && <div><b>Provjeri ručno</b><ul className="pis-rule-list">{academicContext.manualChecks.slice(0, 8).map((item) => <li key={item}>{item}</li>)}</ul></div>}
                  {academicContext.sources.length > 0 && <div><b>Službeni izvori</b><ul className="pis-rule-list">{academicContext.sources.slice(0, 8).map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></li>)}</ul></div>}
                </div>
              ) : <p className="pis-boundary-note">Akademski profil još nije povezan. Ručni podaci ne predstavljaju verificirana pravila fakulteta.</p>}
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
              <a className="pis-primary-link" href={lektaUrl(manuscript, academicContext)} target="_blank" rel="noopener" onClick={() => onLektaHandoff?.()}>Otvori projekt u Lekti ↗</a>
              <p className="pis-boundary-note">Lekta provjerava font, margine, strukturu dokumenta, citatnu mehaniku i formalna pravila. Katedra pomaže riješiti sadržajne posljedice nalaza.</p>
            </section>
          )}

          {tab === 'history' && (
            <section>
              {versionEntries.length > 0 && <VersionBrowser entries={versionEntries} current={manuscript} selectedId={selectedVersionId} onSelect={setSelectedVersionId} onRestore={onRestoreVersion} onRecord={onRecordVersion} />}
              {aiLedgerEntries.length > 0 && <div className="pis-ai-ledger"><b>AI zapis uređivača</b><p className="pis-boundary-note">Datum, sekcija, sažeti opis naredbe, model, ishod i korišteni izvori. Puni rukopis i sadržaj razgovora nisu u ovom zapisu.</p><ul className="pis-tool-list">{aiLedgerEntries.slice(0, 20).map((entry) => <li key={entry.id}><div><b>{entry.action}</b><small>{formatHistoryDate(entry.occurredAt)} · {entry.sectionTitle} · {aiLedgerOutcomeLabel(entry.outcome)}</small><small>{entry.provider || entry.model ? `Sustav: ${entry.provider || 'nepoznat'}${entry.model ? ` / ${entry.model}` : ''}` : 'Sustav nije naveden'}</small><small>Poslano: {entry.sentSummary.instruction || 'kontekst aktivne sekcije'} · {entry.sentSummary.messageCount} poruka · {entry.sentSummary.charCount} znakova · selekcija {entry.sentSummary.selectionChars} znakova</small>{entry.sources.length > 0 && <small>Izvori: {entry.sources.join(', ')}</small>}</div></li>)}</ul><button type="button" onClick={() => downloadAiLedger(aiLedgerEntries)}>Izvezi izjavu o uporabi AI-ja</button></div>}
              <p className="pis-kicker">Samo na ovom uređaju</p><h3>Lokalne verzije i AI zapis</h3>
              <p className="pis-boundary-note">Snapshoti omogućuju povratak rukopisa. AI zapis čuva samo procesne metapodatke, ne akademski tekst.</p>
              {historyEntries.length > 0 ? <div><b>AI zapis</b><ul className="pis-tool-list">{historyEntries.map((entry) => <li key={`${entry.occurredAt}:${entry.sectionId}`}><div><b>{entry.action}</b><small>{formatHistoryDate(entry.occurredAt)} · sekcija {entry.sectionId}</small></div></li>)}</ul></div> : <p className="pis-boundary-note">Još nema prihvaćenih AI promjena.</p>}
            </section>
          )}

          {tab === 'help' && (
            <section>
              <p className="pis-kicker">Kako radi</p><h3>Pišeš ti. Katedra uređuje uz tvoju potvrdu.</h3>
              <ol className="pis-help-steps"><li><b>Piši u sredini.</b><span>Svako poglavlje ima vlastiti prostor i lokalnu verziju.</span></li><li><b>Označi tekst.</b><span>Katedra dobiva samo aktivnu sekciju ili označeni dio.</span></li><li><b>Pregledaj prijedlog.</b><span>Ništa ne ulazi u rukopis dok ne odabereš Prihvati.</span></li><li><b>Izvezi i provjeri.</b><span>DOCX otvori u Wordu i provjeri u Lekti.</span></li></ol>
            </section>
          )}
        </div>
      </aside>
      </FocusTrap>
    </div>
  )
}

function downloadAiLedger(entries: ManuscriptAiLedgerEntry[]) {
  const blob = new Blob([aiLedgerExportText(entries)], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'katedra-izjava-o-uporabi-ai-ja.txt'
  anchor.click()
  URL.revokeObjectURL(url)
}

function VersionBrowser({ entries, current, selectedId, onSelect, onRestore, onRecord }: { entries: ManuscriptSnapshotV1[]; current: ManuscriptV1; selectedId: string | null; onSelect: (id: string | null) => void; onRestore?: (snapshot: ManuscriptSnapshotV1, sectionId?: string, target?: VersionRestoreTarget) => void; onRecord?: () => void }) {
  return (
    <div className="pis-version-browser" aria-label="Pregled lokalnih verzija">
      <b>Lokalne verzije</b>
      <ul className="pis-tool-list">
        {entries.map((entry) => {
          const selected = selectedId === entry.id
          const diff = compareManuscripts(entry.manuscript, entry.after || current)
          return (
            <li key={`browser-${entry.id}`} className="pis-version-entry">
              <div>
                <b>{changeKindLabel(snapshotChangeKind(entry))}</b>
                <small>{entry.reason} · {formatHistoryDate(entry.createdAt)} · {diff.beforeWords} → {diff.afterWords} riječi</small>
              </div>
              <div className="pis-tool-actions">
                <button type="button" onClick={() => onSelect(selected ? null : entry.id)}>{selected ? 'Sakrij razliku' : 'Usporedi s trenutnim'}</button>
                <button type="button" onClick={() => onRestore?.(entry)} disabled={!onRestore}>{entry.after ? 'Vrati prije' : 'Vrati ovu verziju'}</button>
                {entry.after && <button type="button" onClick={() => onRestore?.(entry, undefined, 'after')} disabled={!onRestore}>Vrati poslije</button>}
              </div>
              {selected && (
                <div className="pis-version-diff" role="region" aria-label={`Razlika verzije ${entry.reason}`}>
                  <p>{diff.changedSections} promijenjenih sekcija{diff.titleChanged ? ' · promijenjen naslov' : ''}</p>
                  {diff.sections.filter((section) => section.changed).map((section) => (
                    <div key={section.sectionId} className="pis-version-diff-section">
                      <strong>{section.title}</strong>
                      <div><small>Prije</small><p>{section.beforeText || 'Prazno'}</p></div>
                      <div><small>Trenutno</small><p>{section.afterText || 'Prazno'}</p></div>
                      <button type="button" onClick={() => onRestore?.(entry, section.sectionId)} disabled={!onRestore}>Vrati sekciju</button>
                      {entry.after && <button type="button" onClick={() => onRestore?.(entry, section.sectionId, 'after')} disabled={!onRestore}>Vrati sekciju poslije</button>}
                    </div>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <button type="button" className="pis-secondary-button" onClick={onRecord}>Zabilježi mentorovu reviziju</button>
    </div>
  )
}

function formatRange(min?: number, max?: number): string {
  const format = (value: number) => new Intl.NumberFormat('hr-HR').format(value)
  if (min !== undefined && max !== undefined) return `${format(min)}–${format(max)}`
  if (min !== undefined) return `najmanje ${format(min)}`
  return `najviše ${format(max || 0)}`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 2 }).format(value)
}

function formatHistoryDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function aiLedgerOutcomeLabel(value: ManuscriptAiLedgerEntry['outcome']): string {
  return ({ pending: 'Na čekanju', accepted: 'Prihvaćeno', edited: 'Uređeno', rejected: 'Odbačeno', error: 'Greška' } as Record<ManuscriptAiLedgerEntry['outcome'], string>)[value]
}

function countSnapshotWords(snapshot: ManuscriptV1): number {
  return snapshot.sections.reduce((total, section) => total + countDocumentWords(section.content), 0)
}

export function lektaUrl(manuscript: ManuscriptV1, academicContext?: AcademicContext | null): string {
  const params = new URLSearchParams({ project: manuscript.projectId })
  if (manuscript.meta.unitId) params.set('unit', manuscript.meta.unitId)
  const academicParams = academicHandoffParams(academicContext)
  Object.entries(academicParams).forEach(([key, value]) => params.set(key, value))
  if (!academicParams.profile && manuscript.meta.profileId) params.set('profile', manuscript.meta.profileId)
  params.set('work', manuscript.workType === 's' ? 'seminarski' : manuscript.workType === 'd' ? 'diplomski' : 'zavrsni')
  return `https://lektahr.netlify.app/?${params}`
}

function projectStage(manuscript: ManuscriptV1, lektaSummary: { score: number | null; checkedAt: string; issues: Array<{ status?: string; severity?: string }> }): string {
  const stage = resolveManuscriptProjectStage({ totalWords: countDocumentWordsForManuscript(manuscript), sections: manuscript.sections, lektaSummary })
  return ({ started: 'Početak', scanned: 'Procjena', planned: 'Plan', researching: 'Istraživanje', writing: 'Pisanje', review: 'Recenzija', lekta: 'Lekta', defense: 'Obrana', completed: 'Završen' } as Record<string, string>)[stage] || 'Plan'
}

function nextProjectAction(manuscript: ManuscriptV1, lektaSummary: { score: number | null; checkedAt: string; issues: Array<{ status?: string; severity?: string }> }): string {
  const stage = resolveManuscriptProjectStage({ totalWords: countDocumentWordsForManuscript(manuscript), sections: manuscript.sections, lektaSummary })
  const empty = manuscript.sections.find((section) => section.status === 'empty')
  if (empty) return `Napravi nacrt sekcije „${empty.title}”.`
  const draft = manuscript.sections.find((section) => section.status === 'draft')
  if (draft) return `Pregledaj argument i izvore u sekciji „${draft.title}”.`
  if (stage === 'completed' && isCleanLektaResult(lektaSummary)) return 'Lekta je potvrdila da je dokument spreman za predaju.'
  return 'Izvezi DOCX i pokreni Lekta provjeru.'
}

function countDocumentWordsForManuscript(manuscript: ManuscriptV1): number {
  return manuscript.sections.reduce((sum, section) => sum + countDocumentWords(section.content), 0)
}

function formatLektaDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium' }).format(date)
}
