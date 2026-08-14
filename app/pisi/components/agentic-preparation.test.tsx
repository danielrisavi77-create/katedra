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

    render(<AgenticPreparation projectId="project-1" passActive sectionIds={['intro']} manuscript={manuscript} onRunCreated={onRunCreated} />)
    await user.click(screen.getByRole('radio', { name: /Autonomno/ }))
    await user.click(screen.getByRole('radio', { name: /Šira pretraga/ }))
    await user.click(screen.getByRole('button', { name: 'Pokreni autonomni tijek' }))

    expect(fetchMock).toHaveBeenLastCalledWith('/api/agent-runs?projectId=project-1', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ mode: 'autonomous', sourcePolicy: 'web_research', sectionIds: ['intro'], materialIds: [], manuscript }),
    }))
    expect(onRunCreated).toHaveBeenCalledWith('run-1')
  })

  it('shows the project context before the user starts', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ materials: [] }) }))
    render(<AgenticPreparation projectId="project-1" passActive sectionIds={['intro']} manuscript={manuscript} onRunCreated={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Priprema rada' })).toBeTruthy()
    expect(screen.getByText('Digitalna javna uprava')).toBeTruthy()
    expect(screen.getByText(/Tema i vrsta rada zaključane su za ovaj Pass/)).toBeTruthy()
  })
})
