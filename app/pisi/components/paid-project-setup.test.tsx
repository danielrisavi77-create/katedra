// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PaidProjectSetup } from './paid-project-setup'

const manuscript = {
  schemaVersion: 1 as const,
  projectId: 'project-1',
  title: 'Rad',
  workType: 's' as const,
  activeSectionId: 'intro',
  sections: [{ id: 'intro', title: 'Uvod', kind: 'chapter' as const, order: 0, status: 'draft' as const, content: { type: 'doc' as const, content: [{ type: 'paragraph' as const }] }, updatedAt: '2026-08-14T10:00:00.000Z' }],
  sources: [],
  meta: {},
  createdAt: '2026-08-14T10:00:00.000Z',
  updatedAt: '2026-08-14T10:00:00.000Z',
}

afterEach(() => { cleanup(); window.localStorage.clear(); vi.unstubAllGlobals() })

describe('paid project setup', () => {
  it('keeps consent withdrawal available for a remembered run after Pass expiry', async () => {
    window.localStorage.setItem('katedra_agent_run_v1:project-1', 'run-1')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }))
    render(<PaidProjectSetup projectId="project-1" passActive={false} sectionIds={[]} manuscript={manuscript} />)
    expect(await screen.findByRole('button', { name: 'Povuci pristanak i izbriši privremeni sadržaj' })).toBeTruthy()
  })
  it('keeps the agent flow unavailable until the Pass is active', () => {
    render(<PaidProjectSetup projectId="project-1" passActive={false} sectionIds={[]} manuscript={manuscript} />)
    expect(screen.getByText('Aktiviraj Pass za ovaj projekt.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Privremeni materijali i brisanje' })).toBeTruthy()
    expect(screen.queryByText('Pokreni tijek')).toBeNull()
  })

  it('shows a truthful review empty state and lets the student open preparation', async () => {
    const user = userEvent.setup()
    const onPhaseChange = vi.fn()
    render(<PaidProjectSetup projectId="project-1" passActive={false} sectionIds={[]} manuscript={manuscript} requestedPhase="review" onPhaseChange={onPhaseChange} />)

    expect(screen.getByRole('heading', { name: 'Pregled rezultata' })).toBeTruthy()
    expect(screen.getByText(/Provjereni rezultati pojavit će se nakon pokrenutog tijeka/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Pripremi tijek' }))
    expect(onPhaseChange).toHaveBeenCalledWith('preparation')
  })

  it('starts a run with the selected mode and source policy', async () => {
    const user = userEvent.setup()
    const onPhaseChange = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ runId: 'run-1' }) }))
    render(<PaidProjectSetup projectId="project-1" passActive sectionIds={['intro', 'analysis']} manuscript={manuscript} webResearchAvailable onPhaseChange={onPhaseChange} />)
    expect(screen.getByRole('heading', { name: /Priprema projekta: Rad/i })).toBeTruthy()
    expect(screen.getByText(/Ovaj projekt: Rad/i)).toBeTruthy()
    expect(screen.getByText(/Opseg Passa: Seminarski rad/i)).toBeTruthy()
    await user.click(screen.getByRole('radiogroup', { name: 'Način rada agenata' }).querySelectorAll('label')[2])
    await user.click(screen.getByRole('radiogroup', { name: 'Pravila izvora' }).querySelectorAll('label')[2])
    await user.click(screen.getByRole('checkbox', { name: /Pristajem na privatnu privremenu pohranu/ }))
    await user.click(screen.getByRole('button', { name: 'Pokreni autonomni tijek' }))
    expect(fetch).toHaveBeenCalledWith('/api/agent-runs?projectId=project-1', expect.objectContaining({ method: 'POST', body: JSON.stringify({ mode: 'autonomous', sourcePolicy: 'web_research', sectionIds: ['intro', 'analysis'], materialIds: [], manuscript, snapshotConsent: { accepted: true, version: 'agentic-snapshot-v1' } }) }))
    expect(onPhaseChange).toHaveBeenCalledWith('dashboard')
    vi.unstubAllGlobals()
  })
})
