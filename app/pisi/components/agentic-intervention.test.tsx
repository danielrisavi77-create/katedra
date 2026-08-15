// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgenticIntervention } from './agentic-intervention'

const manuscript = {
  schemaVersion: 1 as const,
  projectId: 'project-1',
  title: 'Digitalna javna uprava',
  workType: 'z' as const,
  activeSectionId: 'intro',
  sections: [{ id: 'intro', title: 'Uvod', kind: 'frontmatter' as const, order: 0, status: 'draft' as const, content: { type: 'doc' as const, content: [{ type: 'paragraph' as const }] }, updatedAt: '2026-08-14T10:00:00.000Z' }],
  sources: [],
  meta: {},
  createdAt: '2026-08-14T10:00:00.000Z',
  updatedAt: '2026-08-14T10:00:00.000Z',
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AgenticIntervention', () => {
  it('shows the verifier reason and resumes only after context upload succeeds', async () => {
    const user = userEvent.setup()
    const onResumed = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ materials: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'run-1', manifestId: 'context-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'running' }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<AgenticIntervention runId="run-1" projectId="project-1" manuscript={manuscript} reason="Nedostaje provjeren izvor." onResumed={onResumed} />)

    expect(screen.getByRole('heading', { name: 'Dodaj kontekst' })).toBeTruthy()
    expect(screen.getByText('Zaustavljeno jer')).toBeTruthy()
    expect(screen.getByText('Nedostaje provjeren izvor.')).toBeTruthy()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/materials?projectId=project-1', expect.anything()))
    const sectionTitle = screen.getByLabelText('Naslov sekcije intro')
    await user.clear(sectionTitle)
    await user.type(screen.getByLabelText('Naslov sekcije intro'), 'Uvod rada')
    await user.click(screen.getByRole('button', { name: 'Spremi kontekst i nastavi' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/agent-runs/run-1/context', expect.objectContaining({ method: 'POST' })))
    expect(fetchMock).toHaveBeenCalledWith('/api/agent-runs/run-1/resume', expect.objectContaining({ method: 'POST' }))
    expect(onResumed).toHaveBeenCalled()
  })

  it('keeps the user in intervention when context upload fails', async () => {
    const user = userEvent.setup()
    const onResumed = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ materials: [] }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Kontekst je prevelik.' }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<AgenticIntervention runId="run-1" projectId="project-1" manuscript={manuscript} reason="Provjera nije prošla." onResumed={onResumed} />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/materials?projectId=project-1', expect.anything()))
    await user.click(screen.getByRole('button', { name: 'Spremi kontekst i nastavi' }))
    await waitFor(() => expect(screen.getAllByRole('alert').map((element) => element.textContent || '').join(' ')).toContain('Kontekst je prevelik.'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onResumed).not.toHaveBeenCalled()
  })
})
