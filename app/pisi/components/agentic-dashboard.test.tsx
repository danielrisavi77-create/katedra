// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  vi.restoreAllMocks()
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('AgenticDashboard', () => {
  it('shows read-only manuscript context and the active verifier', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => runningBody }))
    const onOpenAssistant = vi.fn()
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} onOpenAssistant={onOpenAssistant} />)

    expect(await screen.findByRole('heading', { name: 'Tijek izrade rada' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Dnevnik nastanka rada' })).toBeTruthy()
    expect(screen.getAllByText('Katedra istražuje literaturu').length).toBeGreaterThan(0)
    expect(screen.getByText('Read-only pregled')).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pitaj Katedru o ovom koraku' }))
    expect(onOpenAssistant).toHaveBeenCalledWith(undefined)
    expect(screen.getByText('Početni tekst rada.')).toBeTruthy()
    expect(screen.getByText('Literatura')).toBeTruthy()
    expect(screen.getAllByText(/Pokušaj 2\/3/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/verifikator/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Spremno za pregled').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Autonomni tijek|Agentički workspace|Agent dashboard|Generator|Autopilot/i)).toBeNull()
  })

  it('shows a collapsed metadata-only AI ledger beside the run', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => runningBody }))
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)

    const ledger = await screen.findByRole('group', { name: 'AI zapis' }) as HTMLDetailsElement
    expect(ledger.open).toBe(false)
    expect(screen.getByText('3 poziva')).toBeTruthy()
    await userEvent.setup().click(screen.getByText('AI zapis'))
    expect(within(ledger).getByRole('columnheader', { name: 'Agent' })).toBeTruthy()
    expect(within(ledger).getByRole('columnheader', { name: 'Naplata' })).toBeTruthy()
    expect(within(ledger).getAllByText('Nije poznato')).toHaveLength(3)
  })

  it('keeps the review label while it shows an existing run checkpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => runningBody }))
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} requestedPhase="review" />)

    expect(await screen.findByText('Pregled rezultata')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tijek izrade rada' })).toBeTruthy()
  })

  it('uses the actual nonstandard verifier metadata in the timeline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      ...runningBody,
      steps: [{ ...runningBody.steps[1], verifier: 'evidence_guard_v2' }],
    }) }))
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)

    expect((await screen.findAllByText(/Verifikator Evidence Guard V2/i)).length).toBeGreaterThan(0)
    expect(screen.queryByText('Verifikator literature')).toBeNull()
  })

  it('shows result evidence before accepting a verified proposal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      run: { run_id: 'run-1', project_id: 'project-1', mode: 'autonomous', status: 'completed' },
      steps: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', status: 'verified', attempt: 1 }],
      results: [{ schemaVersion: 1, kind: 'agent-step-result', materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', stepId: 'step-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'intro', baseRevision: '2026-08-14T10:00:00.000Z', attempt: 1, output: 'Novi uvod.', citations: [{ id: 'source-1', title: 'Ustav Republike Hrvatske', url: 'https://example.test/ustav', verified: true }], claims: [{ id: 'claim-1', text: 'Tvrdnja iz uvoda.', citationIds: ['source-1'], support: [{ citationId: 'source-1', quote: 'Relevantan odlomak.', locator: 'str. 4' }] }], verification: { status: 'verified', issues: [], evidence: [{ id: 'source-1', title: 'Ustav Republike Hrvatske', url: 'https://example.test/ustav', verified: true }] }, provider: 'test', usage: { inputTokens: 1, outputTokens: 2 }, createdAt: '2026-08-14T10:01:00.000Z', expiresAt: '2026-08-17T10:01:00.000Z' }],
    }) }))
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)

    expect((await screen.findAllByText('Ustav Republike Hrvatske')).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'https://example.test/ustav' }).length).toBeGreaterThan(0)
    const evidence = screen.getByLabelText('Izvori za Uvod')
    expect(within(evidence).getByText('Identitet izvora provjeren')).toBeTruthy()
    expect(screen.getAllByText('Tvrdnja iz uvoda.').length).toBeGreaterThan(0)
    expect(screen.getByText('Relevantan odlomak.')).toBeTruthy()
  })

  it('keeps authorization and availability errors readable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({}) }))
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)

    expect((await screen.findByRole('alert')).textContent).toContain('Aktiviraj Pass za ovaj projekt kako bi nastavio.')
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
    expect(screen.getAllByText('Nedostaje provjeren izvor.').length).toBeGreaterThan(0)
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

    expect((await screen.findAllByText(/Tijek je zaustavljen zbog gre/)).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Uredi kontekst i nastavi' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Novi tijek' }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('shows verified worker output in review before it can enter the manuscript', async () => {
    const onAcceptDraft = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      run: { run_id: 'run-1', project_id: 'project-1', mode: 'autonomous', status: 'completed' },
      steps: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', status: 'verified', attempt: 1 }],
      results: [{ schemaVersion: 1, kind: 'agent-step-result', materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', stepId: 'step-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'intro', baseRevision: '2026-08-14T10:00:00.000Z', attempt: 1, output: 'Verificirani novi uvod.', citations: [], verification: { status: 'verified', issues: [], evidence: [] }, provider: 'test', usage: { inputTokens: 1, outputTokens: 2 }, createdAt: '2026-08-14T10:01:00.000Z', expiresAt: '2026-08-17T10:01:00.000Z' }],
    }) }))
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} onAcceptDraft={onAcceptDraft} />)

    expect(await screen.findByRole('heading', { name: 'Pregled rezultata' })).toBeTruthy()
    expect(screen.getByDisplayValue('Verificirani novi uvod.')).toBeTruthy()
    await waitFor(() => expect(onAcceptDraft).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Autonomni rezultat je automatski spremljen u lokalni rukopis.')).toBeTruthy()
    await waitFor(() => {
      const proposal = screen.getByRole('heading', { level: 3, name: 'Uvod' }).closest('[data-status]')
      expect(proposal?.getAttribute('data-status')).toBe('accepted')
    })
    expect(screen.queryByRole('button', { name: 'Prihvati Uvod' })).toBeNull()
  })

  it('automatically applies current verified sections for autonomous runs', async () => {
    const onAcceptDraft = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      run: { run_id: 'run-auto', project_id: 'project-1', mode: 'autonomous', status: 'completed' },
      steps: [{ step_id: 'step-auto', agent: 'writing', verifier: 'writing_verifier', status: 'verified', attempt: 1 }],
      results: [{ schemaVersion: 1, kind: 'agent-step-result', materialId: 'agent-result:step-auto:1', projectId: 'project-1', runId: 'run-auto', stepId: 'step-auto', agent: 'writing', verifier: 'writing_verifier', sectionId: 'intro', baseRevision: '2026-08-14T10:00:00.000Z', attempt: 1, output: 'Automatski dodan uvod.', citations: [], verification: { status: 'verified', issues: [], evidence: [] }, provider: 'test', usage: { inputTokens: 1, outputTokens: 2 }, createdAt: '2026-08-16T10:01:00.000Z', expiresAt: '2026-08-19T10:01:00.000Z' }],
    }) }))

    render(<AgenticDashboard runId="run-auto" projectId="project-1" manuscript={manuscript} onAcceptDraft={onAcceptDraft} />)

    await waitFor(() => expect(onAcceptDraft).toHaveBeenCalledTimes(1))
    expect(onAcceptDraft).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run-auto' }), ['intro'])
    expect(await screen.findByText('Autonomni rezultat je automatski spremljen u lokalni rukopis.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Prihvati Uvod' })).toBeNull()
  })

  it('does not mark a proposal accepted when the workspace rejects the merge', async () => {
    const onAcceptDraft = vi.fn().mockResolvedValue(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      run: { run_id: 'run-1', project_id: 'project-1', mode: 'autonomous', status: 'completed' },
      steps: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', status: 'verified', attempt: 1 }],
      results: [{ schemaVersion: 1, kind: 'agent-step-result', materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', stepId: 'step-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'intro', baseRevision: '2026-08-14T10:00:00.000Z', attempt: 1, output: 'Rezultat za odbijeni merge.', citations: [], verification: { status: 'verified', issues: [], evidence: [] }, provider: 'test', usage: { inputTokens: 1, outputTokens: 2 }, createdAt: '2026-08-14T10:01:00.000Z', expiresAt: '2026-08-17T10:01:00.000Z' }],
    }) }))
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} onAcceptDraft={onAcceptDraft} />)

    await waitFor(() => expect(onAcceptDraft).toHaveBeenCalledTimes(1))
    const proposal = screen.getByRole('heading', { level: 3, name: 'Uvod' }).closest('[data-status]')
    expect(proposal?.getAttribute('data-status')).toBe('verified')
    expect(screen.queryByRole('button', { name: 'Prihvati Uvod' })).toBeNull()
    expect(screen.getByText(/Autonomni rezultat nije automatski primijenjen/)).toBeTruthy()
    expect(screen.queryByText('Prihvaćeno')).toBeNull()
  })

  it('shows a readable network error, ends loading and offers retry', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => runningBody })
    vi.stubGlobal('fetch', fetchMock)
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)

    expect((await screen.findByRole('alert')).textContent).toMatch(/mrež.*greš/i)
    expect(screen.getByRole('button', { name: /Pokušaj ponovno/i })).toBeTruthy()
    expect(document.querySelector('.pis-agentic-dashboard')?.getAttribute('aria-busy')).toBe('false')
    await user.click(screen.getByRole('button', { name: /Pokušaj ponovno/i }))
    expect(await screen.findByText('Tijek izrade rada')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('offers retry when polling loses the network after a run was loaded', async () => {
    const pollers: Array<() => void> = []
    vi.spyOn(window, 'setInterval').mockImplementation((handler) => {
      pollers.push(handler as () => void)
      return 1 as unknown as ReturnType<typeof setInterval>
    })
    vi.spyOn(window, 'clearInterval').mockImplementation(() => {})
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => runningBody })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => runningBody })
    vi.stubGlobal('fetch', fetchMock)
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)

    expect(await screen.findByText('Literatura')).toBeTruthy()
    expect(screen.getAllByText(/Verifikator literature/).length).toBeGreaterThan(0)
    expect(pollers.length).toBeGreaterThan(0)
    await act(async () => {
      pollers[0]()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Literatura')).toBeTruthy()
    expect(screen.getAllByText(/Verifikator literature/).length).toBeGreaterThan(0)
    expect((await screen.findByRole('alert')).textContent).toMatch(/mrež.*greš/i)
    fireEvent.click(screen.getByRole('button', { name: /Pokušaj ponovno/i }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(screen.getByText('Literatura')).toBeTruthy()
    expect(screen.getAllByText(/Verifikator literature/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('describes a pending step as waiting in line, not in progress', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      run: { ...runningBody.run, status: 'pending' },
      steps: [{ step_id: 'step-3', agent: 'planning', verifier: 'planning_verifier', status: 'pending', attempt: 1 }],
    }) }))
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)

      expect(await screen.findAllByText('Plan rada čeka svoj red.')).toHaveLength(1)
    expect(screen.queryByText(/Plan rada je u tijeku/i)).toBeNull()
  })

  it('invalidates verification when a verified proposal is edited', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      run: { run_id: 'run-1', project_id: 'project-1', mode: 'guided', status: 'completed' },
      steps: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', status: 'verified', attempt: 1 }],
      results: [{ schemaVersion: 1, kind: 'agent-step-result', materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', stepId: 'step-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'intro', baseRevision: '2026-08-14T10:00:00.000Z', attempt: 1, output: 'Verificirani novi uvod.', citations: [], verification: { status: 'verified', issues: [], evidence: [] }, provider: 'test', usage: { inputTokens: 1, outputTokens: 2 }, createdAt: '2026-08-14T10:01:00.000Z', expiresAt: '2026-08-17T10:01:00.000Z' }],
    }) }))
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)

    const editor = await screen.findByRole('textbox', { name: 'Prijedlog za Uvod' })
    await user.clear(editor)
    await user.type(editor, 'Izmijenjeni tekst bez nove provjere.')

    expect(screen.getByText('Prijedlog je izmijenjen nakon verifikacije; potrebna je nova provjera.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Prihvati Uvod' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Prihvati sve spremne za pregled' })).toHaveProperty('disabled', true)
  })

  it('keeps a local proposal edit when a later worker result arrives', async () => {
    const user = userEvent.setup()
    const resultA = { schemaVersion: 1, kind: 'agent-step-result', materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', stepId: 'step-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'intro', baseRevision: '2026-08-14T10:00:00.000Z', attempt: 1, output: 'Verificirani novi uvod.', citations: [], verification: { status: 'verified', issues: [], evidence: [] }, provider: 'test', usage: { inputTokens: 1, outputTokens: 2 }, createdAt: '2026-08-14T10:01:00.000Z', expiresAt: '2026-08-17T10:01:00.000Z' }
    const resultB = { ...resultA, materialId: 'agent-result:step-2:1', stepId: 'step-2', sectionId: 'analysis', output: 'Novi plan analize.', createdAt: '2026-08-14T10:02:00.000Z' }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ run: { ...runningBody.run, mode: 'guided', status: 'completed' }, steps: [], results: [resultA] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ run: { ...runningBody.run, mode: 'guided', status: 'completed' }, steps: [], results: [resultA, resultB] }) })
    vi.stubGlobal('fetch', fetchMock)
    const view = render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)

    const editor = await screen.findByRole('textbox', { name: 'Prijedlog za Uvod' })
    await user.clear(editor)
    await user.type(editor, 'Lokalno ureÄ‘eni uvod.')

    view.rerender(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={{ ...manuscript }} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect((screen.getByRole('textbox', { name: 'Prijedlog za Uvod' }) as HTMLTextAreaElement).value).toContain('Lokalno')
    expect(screen.getByDisplayValue('Novi plan analize.')).toBeTruthy()
  })

  it('restores a local proposal edit after the dashboard is remounted', async () => {
    const user = userEvent.setup()
    const result = { schemaVersion: 1, kind: 'agent-step-result', materialId: 'agent-result:step-1:1', projectId: 'project-1', runId: 'run-1', stepId: 'step-1', agent: 'writing', verifier: 'writing_verifier', sectionId: 'intro', baseRevision: '2026-08-14T10:00:00.000Z', attempt: 1, output: 'Verificirani novi uvod.', citations: [], verification: { status: 'verified', issues: [], evidence: [] }, provider: 'test', usage: { inputTokens: 1, outputTokens: 2 }, createdAt: '2026-08-14T10:01:00.000Z', expiresAt: '2026-08-17T10:01:00.000Z' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ run: { ...runningBody.run, mode: 'guided', status: 'completed' }, steps: [], results: [result] }) })
    vi.stubGlobal('fetch', fetchMock)
    const first = render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)
    const editor = await screen.findByRole('textbox', { name: 'Prijedlog za Uvod' })
    await user.clear(editor)
    await user.type(editor, 'Edited locally.')
    first.unmount()

    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={manuscript} />)
    expect((await screen.findByRole('textbox', { name: 'Prijedlog za Uvod' }) as HTMLTextAreaElement).value).toContain('Edited')
  })
})
