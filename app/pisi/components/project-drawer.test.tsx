// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createManuscript } from '../../../lib/manuscript/model'
import { ProjectDrawer, lektaUrl } from './project-drawer'
import type { AcademicContext } from '../../../lib/academic-context/types'
import type { ManuscriptSnapshotV1 } from '../../../lib/manuscript/types'
import { createEmptyResearchPlan } from '../../../lib/research-plan/validation'

vi.mock('./paid-project-setup', () => ({
  PaidProjectSetup: ({ onAcceptDraft }: { onAcceptDraft?: unknown }) => (
    <div data-testid="paid-project-setup" data-has-accept={String(Boolean(onAcceptDraft))} />
  ),
}))

afterEach(() => cleanup())

describe('ProjectDrawer agentic entry point', () => {
  it('hands the selected academic rules metadata to Lekta', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'd' })
    const context: AcademicContext = {
      unitId: 'fpzg', profileId: 'fpzg-politologija-diplomski', institutionName: 'FPZG', institutionLabel: 'Sveučilište', profileLabel: 'FPZG diplomski', workType: 'd', status: 'verified', verifiedAt: '2026-06-28',
      wordRange: { min: 10000, max: 12000 }, minimumReferences: 15, minimumBooks: 3, citationStyle: 'FPZG autor–godina', requiredSections: [], manualChecks: [], facts: [], submissionFacts: [], sources: [{ title: 'Upute', url: 'https://fpzg.unizg.hr/upute' }],
      sourcePlan: { minimumReferences: 15, minimumBooks: 3, citationStyle: 'FPZG autor–godina', officialSources: [{ title: 'Upute', url: 'https://fpzg.unizg.hr/upute' }], verification: 'verified_sources_required', guidance: [] }, methodologyPlan: { status: 'verified', workType: 'd', required: false, requiredSections: [], checks: [], guidance: [] },
      aiPolicy: { mode: 'full', claims: [] }, capabilities: { facultyCoaching: true, paidPass: true, webResearch: true, autonomousRun: true },
    }
    const query = new URL(lektaUrl(manuscript, context)).searchParams
    expect(query.get('profile')).toBe('fpzg-politologija-diplomski')
    expect(query.get('rulesMinReferences')).toBe('15')
    expect(query.get('rulesVerifiedAt')).toBe('2026-06-28')
    expect(query.get('rulesSource')).toBe('https://fpzg.unizg.hr/upute')
  })

  it('shows verified formatting rules as read-only academic context', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'd' })
    const context: AcademicContext = {
      unitId: 'fpzg', profileId: 'fpzg-politologija-diplomski', institutionName: 'FPZG', institutionLabel: 'Sveučilište', profileLabel: 'FPZG diplomski', workType: 'd', status: 'verified', verifiedAt: '2026-06-28',
      formatting: { font: 'Times New Roman', fontSize: 12, lineSpacing: 1.5 }, wordRange: { min: 10000, max: 12000 }, minimumReferences: 15, minimumBooks: 3, citationStyle: 'FPZG autor–godina', requiredSections: [], manualChecks: [], facts: [], submissionFacts: [], sources: [{ title: 'Upute', url: 'https://fpzg.unizg.hr/upute' }],
      aiPolicy: { mode: 'full', claims: [] }, capabilities: { facultyCoaching: true, paidPass: true, webResearch: true, autonomousRun: true },
    }

    render(
      <ProjectDrawer
        open manuscript={manuscript} academicContext={context} legacyChecks={{}} mentorTasks={[]} lektaSummary={{ score: null, checkedAt: '', fixedTotal: 0, issues: [] }} passActive
        onClose={vi.fn()} onMetaChange={vi.fn()} onAddSource={vi.fn()} onRemoveSource={vi.fn()} onAddMentorTask={vi.fn()} onToggleMentorTask={vi.fn()} onBackup={vi.fn()} onRestore={vi.fn()} onImportText={vi.fn()} requestedTab="rules"
      />,
    )

    expect(screen.getByText('Times New Roman')).toBeTruthy()
    expect(screen.getByText(/12 pt/)).toBeTruthy()
    expect(screen.getByText('1,5')).toBeTruthy()
  })

  it('uses student-goal drawer tabs and keeps agent status out of primary navigation', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })
    render(
      <ProjectDrawer
        open
        manuscript={manuscript}
        legacyChecks={{}}
        mentorTasks={[]}
        lektaSummary={{ score: null, checkedAt: '', fixedTotal: 0, issues: [] }}
        passActive
        onClose={vi.fn()}
        onMetaChange={vi.fn()}
        onAddSource={vi.fn()}
        onRemoveSource={vi.fn()}
        onAddMentorTask={vi.fn()}
        onToggleMentorTask={vi.fn()}
        onBackup={vi.fn()}
        onRestore={vi.fn()}
        onImportText={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Plan' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Literatura' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mentor' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pravila' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lekta' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pomo\u0107' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Agenti' })).toBeNull()
  })

  it('opens local history and redirects the retired defense route to the plan', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })
    const props = {
      open: true,
      manuscript,
      legacyChecks: {},
      mentorTasks: [],
      lektaSummary: { score: null, checkedAt: '', fixedTotal: 0, issues: [] },
      passActive: true,
      onClose: vi.fn(),
      onMetaChange: vi.fn(),
      onAddSource: vi.fn(),
      onRemoveSource: vi.fn(),
      onAddMentorTask: vi.fn(),
      onToggleMentorTask: vi.fn(),
      onBackup: vi.fn(),
      onRestore: vi.fn(),
      onImportText: vi.fn(),
    }
    const view = render(<ProjectDrawer {...props} requestedTab="history" />)

    expect(screen.getByRole('heading', { name: 'Lokalne verzije i AI zapis' })).toBeTruthy()

    view.rerender(<ProjectDrawer {...props} requestedTab="defense" />)
    expect(screen.getByText(/Plan i zadaci/)).toBeTruthy()
    expect(screen.queryByText('Priprema obrane')).toBeNull()
  })

  it('renders real local snapshots with a restore action', async () => {
    const user = userEvent.setup()
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })
    const snapshot: ManuscriptSnapshotV1 = {
      id: 'snapshot-1',
      projectId: manuscript.projectId,
      reason: 'Prije prihvata AI prijedloga',
      createdAt: '2026-08-22T10:00:00.000Z',
      manuscript,
    }
    const onRestoreVersion = vi.fn()

    render(
      <ProjectDrawer
        open
        manuscript={manuscript}
        legacyChecks={{}}
        mentorTasks={[]}
        lektaSummary={{ score: null, checkedAt: '', fixedTotal: 0, issues: [] }}
        passActive
        onClose={vi.fn()}
        onMetaChange={vi.fn()}
        onAddSource={vi.fn()}
        onRemoveSource={vi.fn()}
        onAddMentorTask={vi.fn()}
        onToggleMentorTask={vi.fn()}
        onBackup={vi.fn()}
        onRestore={vi.fn()}
        onImportText={vi.fn()}
        versionEntries={[snapshot]}
        onRestoreVersion={onRestoreVersion}
        requestedTab="history"
      />,
    )

    expect(screen.getByText(/Prije prihvata AI prijedloga/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Vrati ovu verziju' }))
    expect(onRestoreVersion).toHaveBeenCalledWith(snapshot)
  })

  it('shows before/after diff and restores only the selected section', async () => {
    const user = userEvent.setup()
    const before = createManuscript({ projectId: 'project-1', workType: 'z' })
    const sectionId = before.sections[0].id
    const after = {
      ...before,
      updatedAt: '2026-08-22T10:01:00.000Z',
      sections: before.sections.map((section, index) => index === 0 ? { ...section, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nova teza' }] }] }, updatedAt: '2026-08-22T10:01:00.000Z' } : section),
    }
    const snapshot: ManuscriptSnapshotV1 = {
      id: 'snapshot-diff',
      projectId: before.projectId,
      reason: 'Korisnička promjena: Uvod',
      createdAt: before.updatedAt,
      manuscript: before,
      after,
      changeKind: 'user_change',
      sectionIds: [sectionId],
    }
    const onRestoreVersion = vi.fn()

    render(
      <ProjectDrawer
        open
        manuscript={after}
        legacyChecks={{}}
        mentorTasks={[]}
        lektaSummary={{ score: null, checkedAt: '', fixedTotal: 0, issues: [] }}
        passActive
        onClose={vi.fn()}
        onMetaChange={vi.fn()}
        onAddSource={vi.fn()}
        onRemoveSource={vi.fn()}
        onAddMentorTask={vi.fn()}
        onToggleMentorTask={vi.fn()}
        onBackup={vi.fn()}
        onRestore={vi.fn()}
        onImportText={vi.fn()}
        versionEntries={[snapshot]}
        onRestoreVersion={onRestoreVersion}
        requestedTab="history"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Usporedi s trenutnim' }))
    expect(screen.getByText('Prije')).toBeTruthy()
    expect(screen.getByText('Trenutno')).toBeTruthy()
    expect(screen.getByText('Nova teza')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Vrati sekciju' }))
    expect(onRestoreVersion).toHaveBeenCalledWith(snapshot, sectionId)

    await user.click(screen.getByRole('button', { name: 'Vrati sekciju poslije' }))
    expect(onRestoreVersion).toHaveBeenLastCalledWith(snapshot, sectionId, 'after')
  })

  it('offers an explicit full restore of the after version', async () => {
    const user = userEvent.setup()
    const before = createManuscript({ projectId: 'project-1', workType: 'z', title: 'Prije' })
    const after = { ...before, title: 'Poslije' }
    const snapshot: ManuscriptSnapshotV1 = {
      id: 'snapshot-after', projectId: before.projectId, reason: 'KorisniÄŤka promjena', createdAt: before.updatedAt, manuscript: before, after,
    }
    const onRestoreVersion = vi.fn()

    render(
      <ProjectDrawer
        open manuscript={after} legacyChecks={{}} mentorTasks={[]} lektaSummary={{ score: null, checkedAt: '', fixedTotal: 0, issues: [] }} passActive
        onClose={vi.fn()} onMetaChange={vi.fn()} onAddSource={vi.fn()} onRemoveSource={vi.fn()} onAddMentorTask={vi.fn()} onToggleMentorTask={vi.fn()} onBackup={vi.fn()} onRestore={vi.fn()} onImportText={vi.fn()}
        versionEntries={[snapshot]} onRestoreVersion={onRestoreVersion} requestedTab="history"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Vrati poslije' }))
    expect(onRestoreVersion).toHaveBeenCalledWith(snapshot, undefined, 'after')
  })

  it('offers source verification and reports the result through the workspace callback', async () => {
    const user = userEvent.setup()
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })
    manuscript.sources = [{ id: 'source-1', title: 'Matching title', urlOrDoi: '10.1000/example', verified: false }]
    const onUpdateSource = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      message: { title: ['Matching title'] },
    }), { status: 200 }))

    render(
      <ProjectDrawer
        open
        manuscript={manuscript}
        legacyChecks={{}}
        mentorTasks={[]}
        lektaSummary={{ score: null, checkedAt: '', fixedTotal: 0, issues: [] }}
        passActive
        onClose={vi.fn()}
        onMetaChange={vi.fn()}
        onAddSource={vi.fn()}
        onRemoveSource={vi.fn()}
        onUpdateSource={onUpdateSource}
        onAddMentorTask={vi.fn()}
        onToggleMentorTask={vi.fn()}
        onBackup={vi.fn()}
        onRestore={vi.fn()}
        onImportText={vi.fn()}
        requestedTab="sources"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Provjeri izvor' }))
    expect(onUpdateSource).toHaveBeenCalledWith(expect.objectContaining({
      id: 'source-1',
      verified: true,
      verification: expect.objectContaining({ status: 'verified', method: 'crossref' }),
    }))
    fetchSpy.mockRestore()
  })

  it('passes the manuscript accept callback into the agentic setup', async () => {
    const user = userEvent.setup()
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })

    render(
      <ProjectDrawer
        open
        manuscript={manuscript}
        legacyChecks={{}}
        mentorTasks={[]}
        lektaSummary={{ score: null, checkedAt: '', fixedTotal: 0, issues: [] }}
        passActive
        onClose={vi.fn()}
        onMetaChange={vi.fn()}
        onAddSource={vi.fn()}
        onRemoveSource={vi.fn()}
        onAddMentorTask={vi.fn()}
        onToggleMentorTask={vi.fn()}
        onBackup={vi.fn()}
        onRestore={vi.fn()}
        onImportText={vi.fn()}
        onAcceptDraft={vi.fn().mockResolvedValue(undefined)}
        requestedTab="agents"
      />,
    )

    expect(screen.getByTestId('paid-project-setup').getAttribute('data-has-accept')).toBe('true')
  })

  it('records a Lekta handoff only when the external project link is opened', async () => {
    const user = userEvent.setup()
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })
    const onLektaHandoff = vi.fn()

    render(
      <ProjectDrawer
        open manuscript={manuscript} legacyChecks={{}} mentorTasks={[]} lektaSummary={{ score: null, checkedAt: '', fixedTotal: 0, issues: [] }} passActive
        onClose={vi.fn()} onMetaChange={vi.fn()} onAddSource={vi.fn()} onRemoveSource={vi.fn()} onAddMentorTask={vi.fn()} onToggleMentorTask={vi.fn()} onBackup={vi.fn()} onRestore={vi.fn()} onImportText={vi.fn()} onLektaHandoff={onLektaHandoff}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Lekta' }))
    expect(onLektaHandoff).not.toHaveBeenCalled()
    await user.click(screen.getByRole('link', { name: /Otvori projekt u Lekti/ }))
    expect(onLektaHandoff).toHaveBeenCalledTimes(1)
  })

  it('shows the editor AI ledger metadata needed for an authorship trail', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })

    render(
      <ProjectDrawer
        open manuscript={manuscript} legacyChecks={{}} mentorTasks={[]} lektaSummary={{ score: null, checkedAt: '', fixedTotal: 0, issues: [] }} passActive requestedTab="history"
        aiLedgerEntries={[{
          id: 'ai-1', occurredAt: '2026-08-22T10:00:00.000Z', projectId: 'project-1', sectionId: 'intro', sectionTitle: 'Uvod', action: 'Poboljšaj argument', provider: 'router', model: 'model-x',
          sentSummary: { instruction: 'Sažmi označeni odlomak', messageCount: 2, charCount: 120, selectionChars: 80, attachments: 1, contextKinds: ['active_section', 'selection'] }, outcome: 'accepted', sources: ['Izvor mentora'],
        }]}
        onClose={vi.fn()} onMetaChange={vi.fn()} onAddSource={vi.fn()} onRemoveSource={vi.fn()} onAddMentorTask={vi.fn()} onToggleMentorTask={vi.fn()} onBackup={vi.fn()} onRestore={vi.fn()} onImportText={vi.fn()}
      />,
    )

    expect(screen.getByText(/router \/ model-x/)).toBeTruthy()
    expect(screen.getByText(/Sažmi označeni odlomak/)).toBeTruthy()
    expect(screen.getByText(/Izvor mentora/)).toBeTruthy()
    expect(screen.getByText(/Prihvaćeno/)).toBeTruthy()
  })
  it('shows the real research plan tab only for an allowed project', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'd' })
    render(
      <ProjectDrawer
        open manuscript={manuscript} legacyChecks={{}} mentorTasks={[]} lektaSummary={{ score: null, checkedAt: '', fixedTotal: 0, issues: [] }} passActive
        researchPlan={createEmptyResearchPlan('project-1')}
        researchPlanAccess={{ researchDesign: { allowed: true }, methodology: { allowed: true } }}
        onResearchPlanChange={vi.fn()} onResearchPlanTransition={vi.fn()}
        onClose={vi.fn()} onMetaChange={vi.fn()} onAddSource={vi.fn()} onRemoveSource={vi.fn()} onAddMentorTask={vi.fn()} onToggleMentorTask={vi.fn()} onBackup={vi.fn()} onRestore={vi.fn()} onImportText={vi.fn()}
        requestedTab="research"
      />,
    )

    expect(screen.getByRole('button', { name: 'Istraživački plan' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Istraživački plan' })).toBeTruthy()
  })
})
