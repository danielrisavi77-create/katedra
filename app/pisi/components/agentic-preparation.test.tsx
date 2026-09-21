// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgenticPreparation } from './agentic-preparation'

const manuscript = {
  schemaVersion: 1 as const,
  projectId: 'project-1',
  title: 'Digitalna javna uprava',
  workType: 'z' as const,
  activeSectionId: 'intro',
  sections: [{ id: 'intro', title: 'Uvod', kind: 'frontmatter' as const, order: 0, status: 'draft' as const, content: { type: 'doc' as const, content: [{ type: 'paragraph' as const }] }, updatedAt: '2026-08-14T10:00:00.000Z' }],
  sources: [],
  meta: { institution: 'FPZG', program: 'Politologija', mentor: 'Ana Horvat' },
  createdAt: '2026-08-14T10:00:00.000Z',
  updatedAt: '2026-08-14T10:00:00.000Z',
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AgenticPreparation', () => {
  it('does not send a run until consent is selected for that project', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ materials: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = render(<AgenticPreparation projectId="project-1" passActive sectionIds={['intro']} manuscript={manuscript} onRunCreated={vi.fn()} />)
    const start = screen.getByRole('button', { name: 'Pokreni tijek' }) as HTMLButtonElement
    expect(start.disabled).toBe(true)
    await user.click(start)
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false)
    await user.click(screen.getByRole('checkbox', { name: /Pristajem na privatnu/ }))
    expect(start.disabled).toBe(false)
    rerender(<AgenticPreparation projectId="project-2" passActive sectionIds={['intro']} manuscript={{ ...manuscript, projectId: 'project-2' }} onRunCreated={vi.fn()} />)
    expect(start.disabled).toBe(true)
  })

  it('explains why preparation is locked without an active Pass', () => {
    render(<AgenticPreparation projectId="project-1" passActive={false} sectionIds={['intro']} manuscript={manuscript} onRunCreated={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Aktiviraj Pass za ovaj projekt.' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pokreni autonomni tijek' })).toBeNull()
  })

  it('starts the selected workflow with the locked project context', async () => {
    const user = userEvent.setup()
    const onRunCreated = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ materials: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'run-1' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<AgenticPreparation projectId="project-1" passActive sectionIds={['intro']} manuscript={manuscript} webResearchAvailable onRunCreated={onRunCreated} />)
    await user.click(screen.getByRole('radio', { name: /Autonomno/ }))
    await user.click(screen.getByRole('radio', { name: /Šira pretraga/ }))
    await user.click(screen.getByRole('checkbox', { name: /Pristajem na privatnu/ }))
    await user.click(screen.getByRole('button', { name: 'Pokreni autonomni tijek' }))

    expect(fetchMock).toHaveBeenLastCalledWith('/api/agent-runs?projectId=project-1', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ mode: 'autonomous', sourcePolicy: 'web_research', sectionIds: ['intro'], materialIds: [], manuscript, snapshotConsent: { accepted: true, version: 'agentic-snapshot-v1' } }),
    }))
    expect(onRunCreated).toHaveBeenCalledWith('run-1')
  })

  it('shows the project context before the user starts', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ materials: [] }) }))
    render(<AgenticPreparation projectId="project-1" passActive sectionIds={['intro']} manuscript={manuscript} onRunCreated={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Priprema rada' })).toBeTruthy()
    expect(screen.getByText('Digitalna javna uprava')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Kako nastaje tvoj rad' })).toBeTruthy()
    expect(screen.getByText(/Tema i vrsta rada zaključane su za ovaj Pass/)).toBeTruthy()
    expect(screen.getByText(/Katedra odabire tehničku postavu/i)).toBeTruthy()
    expect(screen.getByText(/Pokreni izradu rada/i)).toBeTruthy()
  })

  it('keeps autonomous projects in the autonomous mode selected during onboarding', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ materials: [] }) }))
    render(<AgenticPreparation projectId="project-1" passActive sectionIds={['intro']} manuscript={manuscript} lockedMode="autonomous" onRunCreated={vi.fn()} />)

    expect(screen.queryByRole('radio', { name: /Vođeno/ })).toBeNull()
    expect(screen.queryByRole('radio', { name: /Ubrzano/ })).toBeNull()
    expect(screen.queryByRole('radio', { name: /Autonomno/ })).toBeNull()
    expect(screen.getByText(/Svaki agent ima zasebnog verifikatora/i)).toBeTruthy()
  })

  it('shows readable material states and a retry action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ materials: [
      { id: 'm-processing', name: 'upute.pdf', kind: 'mentor', extractionStatus: 'processing' },
      { id: 'm-extracted', name: 'literatura.pdf', kind: 'source', extractionStatus: 'extracted' },
      { id: 'm-review', name: 'sken.png', kind: 'scan', extractionStatus: 'needs_review' },
      { id: 'm-failed', name: 'stari-rad.docx', kind: 'draft', extractionStatus: 'failed' },
    ] }) }))
    render(<AgenticPreparation projectId="project-1" passActive sectionIds={['intro']} manuscript={manuscript} onRunCreated={vi.fn()} />)

    expect(await screen.findByText('Čitamo')).toBeTruthy()
    expect(screen.getByText('Pročitano')).toBeTruthy()
    expect(screen.getAllByText('Potrebna provjera').length).toBeGreaterThan(0)
    expect(screen.getByText('Nije moguće pročitati')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Ponovno.*materijal/ })).toBeTruthy()
  })

  it('excludes failed and malformed materials from a new run', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ materials: [
        { id: 'm-failed', name: 'nečitljivo.pdf', kind: 'source', extractionStatus: 'failed' },
        { id: 'm-ready', name: 'literatura.pdf', kind: 'source', extractionStatus: 'extracted' },
        { name: 'bez-id.txt', kind: 'notes', extractionStatus: 'extracted' },
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'run-2' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<AgenticPreparation projectId="project-1" passActive sectionIds={['intro']} manuscript={manuscript} onRunCreated={vi.fn()} />)
    await screen.findByText(/Pro.*itano/)
    await user.click(screen.getByRole('checkbox', { name: /Pristajem na privatnu/ }))
    await user.click(screen.getByRole('button', { name: 'Pokreni tijek' }))

    const request = JSON.parse(fetchMock.mock.calls[1][1].body as string) as { materialIds: string[] }
    expect(request.materialIds).toEqual(['m-ready'])
  })
})
