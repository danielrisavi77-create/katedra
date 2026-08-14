// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createManuscript } from '../../../lib/manuscript/model'
import { ThemeProvider } from '../../theme-provider'
import { WorkspaceShell } from './workspace-shell'

afterEach(cleanup)

describe('WorkspaceShell', () => {
  it('renders outline, manuscript and Katedra as the three primary regions', () => {
    const manuscript = createManuscript({
      projectId: 'project-1',
      title: 'Digitalizacija javne uprave',
      workType: 'z',
    })

    render(
      <ThemeProvider><WorkspaceShell
        manuscript={manuscript}
        saveStatus="saved"
        activeMobileView="editor"
        onMobileViewChange={vi.fn()}
        onExport={vi.fn()}
        outline={<p>Sadržaj rukopisa</p>}
        editor={<p>Uređivi dokument</p>}
        assistant={<p>Katedra prijedlozi</p>}
      /></ThemeProvider>,
    )

    expect(screen.getByRole('navigation', { name: /struktura rada/i })).toBeTruthy()
    expect(screen.getByRole('main').textContent).toContain('Uređivi dokument')
    expect(screen.getByRole('complementary', { name: /katedra urednik/i }).textContent).toContain('Katedra prijedlozi')
    expect(screen.getByText(/spremljeno na ovom uređaju/i)).toBeTruthy()
  })

  it('announces the active mobile context and calls the requested view', async () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })
    const onMobileViewChange = vi.fn()
    render(<ThemeProvider><WorkspaceShell
      manuscript={manuscript}
      saveStatus="saved"
      activeMobileView="editor"
      onMobileViewChange={onMobileViewChange}
      onExport={vi.fn()}
      outline={<p>Outline</p>}
      editor={<p>Editor</p>}
      assistant={<p>Assistant</p>}
    /></ThemeProvider>)

    const mobileNav = screen.getByRole('navigation', { name: /radni prostor/i })
    expect(mobileNav.querySelector('[aria-current="page"]')?.textContent).toMatch(/rukopis/i)
    const { default: userEvent } = await import('@testing-library/user-event')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Katedra' }))
    expect(onMobileViewChange).toHaveBeenCalledWith('assistant')
  })

  it('announces the current agentic phase and project lock', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })
    render(<ThemeProvider><WorkspaceShell
      manuscript={manuscript}
      saveStatus="saved"
      activeMobileView="editor"
      onMobileViewChange={vi.fn()}
      onExport={vi.fn()}
      outline={<p>Outline</p>}
      editor={<p>Editor</p>}
      assistant={<p>Assistant</p>}
      view="dashboard"
      projectLocked
      activeAgentLabel="Sources"
      agenticContent={<p>Agentic screen</p>}
    /></ThemeProvider>)

    expect(screen.getByText('Autonomni tijek')).toBeTruthy()
    expect(screen.getByText('Projekt zaključan')).toBeTruthy()
    expect(screen.getByText('Sources')).toBeTruthy()
    expect(screen.getByTestId('pis-workspace-root').getAttribute('data-workspace-view')).toBe('dashboard')
    expect(screen.getByRole('main', { name: 'Agentički workspace' }).textContent).toContain('Agentic screen')
  })
})
