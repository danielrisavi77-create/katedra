// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '../theme-provider'
import RacunPage from './page'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Moj račun anonymous state', () => {
  it('does not expose account-only deletion or withdrawal actions before login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Prijavi se.' }),
    }))

    render(<ThemeProvider><RacunPage /></ThemeProvider>)

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Prijavi se.'))

    expect(screen.queryByRole('button', { name: /brisanje ra/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /jednostrani raskid/i })).toBeNull()
    expect(screen.getByRole('link', { name: /prijavi se/i }).getAttribute('href')).toBe('/prijava?redirect=/racun')
  })

  it('does not render unavailable account data as confirmed zeros', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { email: 'student@example.com' },
        projects: null,
        passes: null,
        usage: null,
        warnings: ['Projekti trenutačno nisu dostupni.', 'AI potrošnja trenutačno nije dostupna.'],
      }),
    }))

    render(<ThemeProvider><RacunPage /></ThemeProvider>)

    await waitFor(() => expect(screen.getByText('student@example.com')).toBeTruthy())

    expect(document.body.textContent).not.toContain('0projekata')
    expect(document.body.textContent).not.toContain('0AI zahtjeva')
    expect(screen.getAllByText(/AI potrošnja trenutačno nije dostupna/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Projekti trenutačno nisu dostupni/i).length).toBeGreaterThan(0)
  })

  it('keeps project and Pass scope visible in the authenticated account overview', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { email: 'student@example.com' },
        projects: [{ project_id: 'project-1', topic: 'Digitalizacija javne uprave', work_type_canonical: 'diplomski', deadline: '2026-12-01', lekta_score: null }],
        passes: [{ academic_project_id: 'project-1', product_id: 'katedra_diplomski', status: 'active' }],
        usage: { requests: 2, inputTokens: 10, outputTokens: 20, charged: 1 },
        warnings: [],
      }),
    }))

    render(<ThemeProvider><RacunPage /></ThemeProvider>)

    await waitFor(() => expect(screen.getByText('student@example.com')).toBeTruthy())

    expect(screen.getByRole('heading', { name: 'Identitet računa' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Moji projekti' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Pass po projektu' })).toBeTruthy()
    expect(screen.getAllByText('Digitalizacija javne uprave').length).toBeGreaterThanOrEqual(1)
  })
})
