// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createManuscript, plainTextDocument } from '../../../lib/manuscript/model'
import { createAgenticDraft, upsertSectionRevision } from '../../../lib/manuscript/agentic-revisions'
import { AgenticReview } from './agentic-review'

afterEach(() => cleanup())

describe('AgenticReview', () => {
  it('offers accept-all and section-level actions only for verified sections', async () => {
    const user = userEvent.setup()
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z', now: '2026-08-14T10:00:00.000Z' })
    const first = manuscript.sections[0]
    const second = manuscript.sections[1]
    const draft = [
      { sectionId: first.id, baseRevision: first.updatedAt, proposedContent: plainTextDocument('Novi uvod.'), status: 'verified' as const, verificationMessage: 'Provjereno.', updatedAt: '2026-08-14T10:02:00.000Z' },
      { sectionId: second.id, baseRevision: second.updatedAt, proposedContent: plainTextDocument('Nedovršeni tekst.'), status: 'blocked' as const, verificationMessage: 'Nedostaje izvor.', updatedAt: '2026-08-14T10:02:00.000Z' },
    ].reduce((current, revision) => upsertSectionRevision(current, revision), createAgenticDraft({ projectId: manuscript.projectId, runId: 'run-1', base: manuscript }))
    const onAccept = vi.fn().mockResolvedValue(true)
    render(<AgenticReview manuscript={manuscript} draft={draft} onAccept={onAccept} onEdit={vi.fn()} onReject={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Pregled rezultata' })).toBeTruthy()
    expect(screen.getByText('Nedostaje izvor.')).toBeTruthy()
    expect(screen.getAllByText('Usporedba s rukopisom')).toHaveLength(2)
    expect(screen.getAllByText('Trenutna verzija')).toHaveLength(2)
    expect(screen.getAllByText('Novi prijedlog')).toHaveLength(2)
    expect(screen.getByText('Pregledaj rezultat')).toBeTruthy()
    expect(screen.queryByText(/Agent dashboard|Generator|Autopilot/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Prihvati sve spremne za pregled' })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Prihvati ${first.title}` })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Prihvati ${second.title}` })).toHaveProperty('disabled', true)
    await user.click(screen.getByRole('button', { name: 'Prihvati sve spremne za pregled' }))
    expect(onAccept).toHaveBeenCalledWith()
    const firstProposal = screen.getByRole('heading', { name: first.title }).closest('[data-status]')
    expect(firstProposal).toBeTruthy()
    expect(within(firstProposal as HTMLElement).getAllByText('Prihvaćeno')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: `Prihvati ${first.title}` })).toBeNull()
    expect((screen.getByRole('textbox', { name: `Prijedlog za ${first.title}` }) as HTMLTextAreaElement).readOnly).toBe(true)
    expect(screen.getAllByText(/Nema.*izvora/).length).toBeGreaterThan(0)
  })

  it('does not turn an unsafe verifier URL into a clickable link', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z', now: '2026-08-14T10:00:00.000Z' })
    const first = manuscript.sections[0]
    const draft = [
      {
        sectionId: first.id,
        baseRevision: first.updatedAt,
        proposedContent: plainTextDocument('Novi uvod.'),
        status: 'verified' as const,
        verificationMessage: 'Provjereno.',
        updatedAt: '2026-08-14T10:02:00.000Z',
        evidence: [{ id: 'unsafe', title: 'Neprovjereni izvor', url: 'javascript:alert(1)', verified: false }],
      },
    ].reduce((current, revision) => upsertSectionRevision(current, revision), createAgenticDraft({ projectId: manuscript.projectId, runId: 'run-1', base: manuscript }))

    render(<AgenticReview manuscript={manuscript} draft={draft} onAccept={vi.fn()} onEdit={vi.fn()} onReject={vi.fn()} />)

    expect(screen.getByText('Neprovjereni izvor')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'javascript:alert(1)' })).toBeNull()
  })

  it('shows claim-level passages without presenting them as automatic proof', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z', now: '2026-08-14T10:00:00.000Z' })
    const first = manuscript.sections[0]
    const baseDraft = upsertSectionRevision(createAgenticDraft({ projectId: manuscript.projectId, runId: 'run-1', base: manuscript }), {
      sectionId: first.id,
      baseRevision: first.updatedAt,
      proposedContent: plainTextDocument('Novi uvod.'),
      status: 'verified',
      updatedAt: '2026-08-14T10:02:00.000Z',
    })
    const draft = {
      ...baseDraft,
      sections: baseDraft.sections.map((revision) => revision.sectionId === first.id ? {
        ...revision,
        status: 'verified' as const,
        baseRevision: first.updatedAt,
        proposedContent: plainTextDocument('Novi uvod.'),
        claims: [{
          id: 'claim-1',
          text: 'Tvrdnja o istraživanju.',
          citationIds: ['source-1'],
          support: [{ citationId: 'source-1', quote: 'Relevantan odlomak iz izvora.', locator: 'str. 4' }],
        }],
      } : revision),
    }

    render(<AgenticReview manuscript={manuscript} draft={draft} onAccept={vi.fn()} onEdit={vi.fn()} onReject={vi.fn()} />)

    expect(screen.getByText('Tvrdnje i dokazni trag')).toBeTruthy()
    expect(screen.getByText('Tvrdnja o istraživanju.')).toBeTruthy()
    expect(screen.getByText('Relevantan odlomak iz izvora.')).toBeTruthy()
    expect(screen.getByText(/ne potvrđuje sama istinitost/i)).toBeTruthy()
    expect(screen.getByText(/nije automatski dokaz/i)).toBeTruthy()
  })
})
