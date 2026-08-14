// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from './theme-provider'
import { ThemeToggle } from './theme-toggle'
import { WorkspaceShell } from './pisi/components/workspace-shell'
import { OnboardingFlow } from './pisi/components/onboarding-flow'
import { createManuscript } from '../lib/manuscript/model'

afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.theme
  vi.unstubAllGlobals()
})

describe('ThemeProvider', () => {
  it('uses the device theme then persists a user-selected override', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    render(<ThemeProvider><ThemeToggle /></ThemeProvider>)

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    await user.click(screen.getByRole('button', { name: /uključi svijetlu temu/i }))

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('katedra-theme')).toBe('light')
  })

  it('keeps the theme switch reachable from the manuscript workspace', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    const manuscript = createManuscript({ projectId: 'theme-project', workType: 'z', title: 'Tema' })

    render(
      <ThemeProvider>
        <WorkspaceShell
          manuscript={manuscript}
          saveStatus="saved"
          activeMobileView="editor"
          onMobileViewChange={() => {}}
          onExport={() => {}}
          outline={<span>Outline</span>}
          editor={<span>Editor</span>}
          assistant={<span>Assistant</span>}
        />
      </ThemeProvider>,
    )

    expect(await screen.findByRole('button', { name: /uključi tamnu temu/i })).toBeTruthy()
  })

  it('keeps the theme switch reachable before a manuscript is opened', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))

    render(<ThemeProvider><OnboardingFlow onComplete={() => {}} /></ThemeProvider>)

    expect(await screen.findByRole('button', { name: /uključi tamnu temu/i })).toBeTruthy()
  })
})
