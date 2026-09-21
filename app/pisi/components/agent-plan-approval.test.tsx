// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { AgentPlanApproval } from './agent-plan-approval'

const review = { ready: true, approved: false, planRevision: 'a'.repeat(64), sourceLabels: { source: 'Autor, Dokaz, 2026' }, plan: { thesis: 'Teza za pregled', perspectives: [{ label: 'Perspektiva', position: 'Stav', why: 'Razlog' }], chapters: [{ title: 'Uvod', content: 'Program poglavlja', sources: ['source'] }] } }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('waits for an explicit click after displaying plan and source labels, then confirms before resume', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => review })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ approved: true }) }).mockResolvedValueOnce({ ok: true })
  vi.stubGlobal('fetch', fetchMock)
  const resumed = vi.fn()
  render(<AgentPlanApproval runId="run-1" projectId="project-1" onResumed={resumed} />)
  await screen.findByText('Teza za pregled', { exact: false })
  expect(screen.getByText('Program poglavlja')).toBeInTheDocument()
  expect(screen.getByText('Izvori: Autor, Dokaz, 2026')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole('button', { name: 'Odobri plan i nastavi' }))
  await waitFor(() => expect(resumed).toHaveBeenCalledOnce())
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ projectId: 'project-1', planRevision: review.planRevision, approve: true })
  expect(fetchMock.mock.calls[2][0]).toBe('/api/agent-runs/run-1/resume')
})

it('does not resume a stale plan and requires review of the replacement', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => review })
    .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'Plan se promijenio.' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...review, planRevision: 'b'.repeat(64) }) })
  vi.stubGlobal('fetch', fetchMock)
  const resumed = vi.fn()
  render(<AgentPlanApproval runId="run-1" projectId="project-1" onResumed={resumed} />)
  await screen.findByText('Program poglavlja')
  await userEvent.click(screen.getByRole('button', { name: 'Odobri plan i nastavi' }))
  await screen.findByText('Plan se promijenio.')
  expect(resumed).not.toHaveBeenCalled()
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/resume'))).toBe(false)
})

it('does not offer confirmation for an incomplete plan', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...review, ready: false }) }))
  render(<AgentPlanApproval runId="run-1" projectId="project-1" onResumed={vi.fn()} />)
  await screen.findByText('Program poglavlja')
  expect(screen.getByRole('button', { name: 'Odobri plan i nastavi' })).toBeDisabled()
})

it('does not ask for approval again when the current plan is already approved', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...review, approved: true }) })
  vi.stubGlobal('fetch', fetchMock)
  render(<AgentPlanApproval runId="run-1" projectId="project-1" onResumed={vi.fn()} />)
  await screen.findByText('Plan je odobren.')
  expect(screen.queryByRole('button', { name: 'Odobri plan i nastavi' })).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
