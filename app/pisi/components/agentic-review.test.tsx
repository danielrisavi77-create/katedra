// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
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
    const onAccept = vi.fn()
    render(<AgenticReview manuscript={manuscript} draft={draft} onAccept={onAccept} onEdit={vi.fn()} onReject={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Pregled rezultata' })).toBeTruthy()
    expect(screen.getByText('Nedostaje izvor.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Prihvati sve provjerene' })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Prihvati ${first.title}` })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Prihvati ${second.title}` })).toHaveProperty('disabled', true)
    await user.click(screen.getByRole('button', { name: 'Prihvati sve provjerene' }))
    expect(onAccept).toHaveBeenCalledWith()
  })
})
