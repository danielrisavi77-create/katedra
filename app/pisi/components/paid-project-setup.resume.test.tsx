// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createManuscript } from '../../../lib/manuscript/model'
import { PaidProjectSetup } from './paid-project-setup'

vi.mock('./agent-run-panel', () => ({
  AgentRunPanel: ({ runId, requestedPhase }: { runId: string; requestedPhase?: string }) => <div data-testid="agent-run-panel" data-requested-phase={requestedPhase}>{runId}</div>,
}))

vi.mock('./agentic-preparation', () => ({
  AgenticPreparation: () => <div data-testid="agentic-preparation" />,
}))

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('PaidProjectSetup run recovery', () => {
  it('reopens the latest active server run after the component is mounted again', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [
        { run_id: 'run-completed', status: 'completed' },
        { run_id: 'run-active', status: 'running' },
      ] }),
    }))

    render(<PaidProjectSetup
      projectId="project-1"
      passActive
      sectionIds={['section-1']}
      manuscript={createManuscript({ projectId: 'project-1', workType: 'z' })}
    />)

    await waitFor(() => expect(screen.getByTestId('agent-run-panel').textContent).toBe('run-active'))
    expect(fetch).toHaveBeenCalledWith('/api/agent-runs?projectId=project-1', expect.objectContaining({ cache: 'no-store' }))
  })

  it('passes the selected review phase through to a resumed run panel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [{ run_id: 'run-active', status: 'running' }] }),
    }))

    render(<PaidProjectSetup
      projectId="project-1"
      passActive
      requestedPhase="review"
      sectionIds={['section-1']}
      manuscript={createManuscript({ projectId: 'project-1', workType: 'z' })}
    />)

    await waitFor(() => expect(screen.getByTestId('agent-run-panel').getAttribute('data-requested-phase')).toBe('review'))
  })

  it('discards a stale local run id when the canonical list no longer contains it', async () => {
    window.localStorage.setItem('katedra_agent_run_v1:project-1', 'run-gone')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [{ run_id: 'run-current', status: 'paused' }] }),
    }))

    render(<PaidProjectSetup
      projectId="project-1"
      passActive
      sectionIds={['section-1']}
      manuscript={createManuscript({ projectId: 'project-1', workType: 'z' })}
    />)

    await waitFor(() => expect(screen.getByTestId('agent-run-panel').textContent).toBe('run-current'))
    expect(window.localStorage.getItem('katedra_agent_run_v1:project-1')).toBe('run-current')
  })

  it('does not auto-resume a failed server run without a local marker', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [{ run_id: 'run-failed', status: 'failed' }] }),
    }))

    render(<PaidProjectSetup
      projectId="project-1"
      passActive
      sectionIds={['section-1']}
      manuscript={createManuscript({ projectId: 'project-1', workType: 'z' })}
    />)

    await waitFor(() => expect(screen.getByTestId('agentic-preparation')).toBeTruthy())
    expect(screen.queryByTestId('agent-run-panel')).toBeNull()
  })
})
