// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AdminPage from './page'
import { ThemeProvider } from '../theme-provider'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('/admin', () => {
  it('renders the protected operational overview returned by the admin API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        admin: { enabled: true },
        user: { email: 'danielrisavi77@gmail.com' },
        projects: [{ project_id: 'project-1', topic: 'Tema rada', work_type_canonical: 'zavrsni' }],
        agentRuns: [{ run_id: 'run-1', status: 'running' }],
        usage: { requests: 2, inputTokens: 10, outputTokens: 20, charged: 0 },
        featureFlags: { projectLocks: true, agentRuns: false, materials: false, billingContract: 'v2' },
        warnings: [],
      }),
    }))

    render(<ThemeProvider><AdminPage /></ThemeProvider>)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Admin pregled' })).toBeTruthy())
    expect(screen.getByText('danielrisavi77@gmail.com')).toBeTruthy()
    expect(screen.getByText('Tema rada')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Agent runovi' })).toBeTruthy()
  })

  it('does not render operational data when the API denies access', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Admin pristup nije dopušten.' }),
    }))

    render(<ThemeProvider><AdminPage /></ThemeProvider>)

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Admin pristup nije dopušten.'))
    expect(screen.queryByText('Operativni pregled')).toBeNull()
  })
})
