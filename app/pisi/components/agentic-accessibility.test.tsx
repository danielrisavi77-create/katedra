// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createManuscript } from '../../../lib/manuscript/model'
import { AgenticDashboard } from './agentic-dashboard'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('agentic workspace accessibility contract', () => {
  it('uses live status, labeled controls and text status in a blocked state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      run: { run_id: 'run-1', project_id: 'project-1', mode: 'autonomous', status: 'blocked' },
      steps: [{ step_id: 'step-1', agent: 'sources', verifier: 'sources_verifier', status: 'blocked', attempt: 3, last_verification: { issues: [{ message: 'Izvor nije potvrđen.' }] } }],
    }) }))
    render(<AgenticDashboard runId="run-1" projectId="project-1" manuscript={createManuscript({ projectId: 'project-1', workType: 'z' })} />)

    expect(await screen.findByText('Potrebna je intervencija')).toBeTruthy()
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Uredi kontekst i nastavi' })).toBeTruthy()
    expect(screen.getByText('Izvor nije potvrđen.')).toBeTruthy()
  })
})
