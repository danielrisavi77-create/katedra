// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createManuscript } from '../../../lib/manuscript/model'
import { PaidProjectSetup } from './paid-project-setup'

vi.mock('./agent-run-panel', () => ({
  AgentRunPanel: ({ runId }: { runId: string }) => <div data-testid="agent-run-panel">{runId}</div>,
}))

vi.mock('./agentic-preparation', () => ({
  AgenticPreparation: () => <div data-testid="agentic-preparation" />,
}))

afterEach(() => {
  cleanup()
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
})
