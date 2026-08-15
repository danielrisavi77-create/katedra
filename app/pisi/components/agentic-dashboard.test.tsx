// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgenticDashboard } from './agentic-dashboard'

const manuscript = {
  schemaVersion: 1 as const,
  projectId: 'project-1',
  title: 'Digitalna javna uprava',
  workType: 'z' as const,
  activeSectionId: 'intro',
  sections: [
    { id: 'intro', title: 'Uvod', kind: 'frontmatter' as const, order: 0, status: 'draft' as const, content: { type: 'doc' as const, content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Početni tekst rada.' }] }] }, updatedAt: '2026-08-14T10:00:00.000Z' },
    { id: 'analysis', title: 'Analiza', kind: 'chapter' as const, order: 1, status: 'empty' as const, content: { type: 'doc' as const, content: [{ type: 'paragraph' as const }] }, updatedAt: '2026-08-14T10:00:00.000Z' },
  ],
  sources: [],
  meta: {},
  createdAt: '2026-08-14T10:00:00.000Z',
  updatedAt: '2026-08-14T10:00:00.000Z',
}

const runningBody = {
  run: { run_id: 'run-1', project_id: 'project-1', mode: 'autonomous', status: 'running' },
  steps: [
    { step_id: 'step-1', agent: 'intake', verifier: 'intake_verifier', status: 'verified', attempt: 1 },
    { step_id: 'step-2', agent: 'sources', verifier: 'sources_verifier', status: 'running', attempt: 2 },
    { step_id: 'step-3', agent: 'planning', verifier: 'planning_verifier', status: 'pending', attempt: 1 },
  ],
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AgenticDashboard', () => {
  it('shows read-only manuscript context and the active verifier', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => runningBody }))
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)

    expect(await screen.findByRole('heading', { name: 'Autonomni tijek' })).toBeTruthy()
    expect(screen.getByText('Read-only pregled')).toBeTruthy()
    expect(screen.getByText('Početni tekst rada.')).toBeTruthy()
    expect(screen.getAllByText(/Sources/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Pokušaj 2\/3/)).toBeTruthy()
  })

  it('pauses the server-side run and refreshes its status', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => runningBody })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ run: { ...runningBody.run, status: 'paused' }, steps: runningBody.steps }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ run: { ...runningBody.run, status: 'paused' }, steps: runningBody.steps }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)

    await user.click(await screen.findByRole('button', { name: 'Pauziraj tijek' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/agent-runs/run-1/pause', expect.objectContaining({ method: 'POST' })))
    expect(await screen.findByRole('button', { name: 'Nastavi tijek' })).toBeTruthy()
  })

  it('makes a blocked run visibly actionable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      run: { ...runningBody.run, status: 'blocked' },
      steps: [{ ...runningBody.steps[1], status: 'blocked', last_verification: { issues: [{ message: 'Nedostaje provjeren izvor.' }] } }],
    }) }))
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)

    expect(await screen.findByText('Potrebna je intervencija')).toBeTruthy()
    expect(screen.getByText('Nedostaje provjeren izvor.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Uredi kontekst i nastavi' })).toBeTruthy()
  })

  it('treats a failed run as terminal and offers a new workflow', async () => {
    const user = userEvent.setup()
    const onReset = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      run: { ...runningBody.run, status: 'failed' },
      steps: [{ ...runningBody.steps[1], status: 'failed', last_verification: { issues: [{ message: 'Provider nije dostupan.' }] } }],
    }) }))
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} onReset={onReset} />)

    expect(await screen.findByText(/Tijek je zaustavljen zbog gre/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Uredi kontekst i nastavi' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Novi tijek' }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
