// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { AgentRunPrivacy } from './agent-run-privacy'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it.each(['deleted', 'pending'])('withdraws independently of dashboard availability and reports %s truthfully', async cleanupStatus => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ consentRevoked: true, cleanup: cleanupStatus }) })
  vi.stubGlobal('fetch', fetchMock)
  const onRevoked = vi.fn()
  render(<AgentRunPrivacy runId="run-1" projectId="project-1" onRevoked={onRevoked} />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Povuci pristanak i izbriši privremeni sadržaj' }))
  expect(fetchMock).toHaveBeenCalledWith('/api/agent-runs/run-1?projectId=project-1', { method: 'DELETE' })
  expect(onRevoked).toHaveBeenCalledOnce()
  expect(screen.getByRole('status').textContent).toContain(cleanupStatus === 'pending' ? 'čeka ponovni pokušaj' : 'sadržaj je izbrisan')
  if (cleanupStatus === 'pending') expect(screen.getByRole('button', { name: 'Ponovi brisanje' })).toBeTruthy()
})
it('does not claim withdrawal after a failed request', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  const onRevoked = vi.fn()
  render(<AgentRunPrivacy runId="run-1" projectId="project-1" onRevoked={onRevoked} />)
  await userEvent.setup().click(screen.getByRole('button'))
  expect(onRevoked).not.toHaveBeenCalled()
  expect(screen.getByRole('status').textContent).toContain('nije uspjelo')
})
