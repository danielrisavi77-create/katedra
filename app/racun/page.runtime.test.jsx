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
})
