// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
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

  it('renders the student project navigation beside the three writing regions', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })

    render(<ThemeProvider><WorkspaceShell
      manuscript={manuscript}
      saveStatus="saved"
      activeMobileView="editor"
      onMobileViewChange={vi.fn()}
      onExport={vi.fn()}
      outline={<p>Struktura</p>}
      editor={<p>Rukopis</p>}
      assistant={<p>Urednik</p>}
      activeNavItem="writing"
      onNavigate={vi.fn()}
      workType="z"
    /></ThemeProvider>)

    expect(screen.getByRole('navigation', { name: 'Projekt' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: /struktura rada/i })).toBeTruthy()
    expect(screen.getByRole('main').textContent).toContain('Rukopis')
    expect(screen.getByRole('complementary', { name: /katedra urednik/i }).textContent).toContain('Urednik')
    expect(screen.getByTestId('pis-writing-frame')).toBeTruthy()
  })

  it('keeps the overview mobile context as the default project context', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    const onMobileViewChange = vi.fn()

    render(<ThemeProvider><WorkspaceShell
      manuscript={createManuscript({ projectId: 'project-1', workType: 'z' })}
      saveStatus="saved"
      activeMobileView="overview"
      onMobileViewChange={onMobileViewChange}
      onExport={vi.fn()}
      outline={<p>Struktura</p>}
      editor={<p>Rukopis</p>}
      assistant={<p>Urednik</p>}
    /></ThemeProvider>)

    const nav = screen.getByRole('navigation', { name: /radni prostor/i })
    expect(within(nav).getAllByRole('button')).toHaveLength(3)
    expect(within(nav).getByRole('button', { name: 'Pregled' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('button', { name: 'Rukopis' })).toBeTruthy()
    expect(within(nav).getByRole('button', { name: 'Katedra' })).toBeTruthy()

    await user.click(within(nav).getByRole('button', { name: 'Katedra' }))
    expect(onMobileViewChange).toHaveBeenCalledWith('assistant')
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

    expect(screen.queryByText('Autonomni tijek')).toBeNull()
    expect(screen.queryByText('Projekt zaključan')).toBeNull()
    expect(screen.queryByText('Sources')).toBeNull()
    expect(screen.getByTestId('pis-workspace-root').getAttribute('data-workspace-view')).toBe('dashboard')
    expect(screen.getByRole('main', { name: 'Agentički workspace' }).textContent).toContain('Agentic screen')
  })
})
