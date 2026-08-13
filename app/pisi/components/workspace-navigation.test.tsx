// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '../../theme-provider'
import { MobileWorkspaceNav } from './mobile-workspace-nav'
import { WorkspaceNavigation } from './workspace-navigation'

afterEach(cleanup)

function renderNavigation(overrides: Partial<React.ComponentProps<typeof WorkspaceNavigation>> = {}) {
  const props: React.ComponentProps<typeof WorkspaceNavigation> = {
    projectTitle: 'Digitalizacija javne uprave',
    saveStatus: 'saved',
    syncStatus: 'local_only',
    totalWords: 1240,
    account: <a className="pis-account" href="/racun">daniel@example.com</a>,
    onOpenTools: vi.fn(),
    onExport: vi.fn(),
    ...overrides,
  }

  return render(<ThemeProvider><WorkspaceNavigation {...props} /></ThemeProvider>)
}

describe('WorkspaceNavigation', () => {
  it('shows project identity, active section, save status and primary actions', () => {
    renderNavigation()

    expect(screen.getByRole('link', { name: /Katedra početna/i })).toBeTruthy()
    expect(screen.queryByText('Teorijski okvir')).toBeNull()
    expect(screen.getByRole('status').textContent).toMatch(/Spremljeno/i)
    expect(screen.getByRole('button', { name: /Projekt/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Izvezi DOCX/i })).toBeTruthy()
  })

  it('calls project and export callbacks from desktop actions', async () => {
    const user = userEvent.setup()
    const onOpenTools = vi.fn()
    const onExport = vi.fn()

    renderNavigation({ onOpenTools, onExport })

    await user.click(screen.getByRole('button', { name: /^Projekt$/i }))
    await user.click(screen.getByRole('button', { name: /Izvezi DOCX/i }))

    expect(onOpenTools).toHaveBeenCalledOnce()
    expect(onExport).toHaveBeenCalledOnce()
  })

  it('opens the mobile overflow menu and closes it with Escape', async () => {
    const user = userEvent.setup()
    renderNavigation()

    const trigger = screen.getByRole('button', { name: /Dodatne radnje/i })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    await user.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const menu = screen.getByRole('menu', { name: /Dodatne radnje/i })
    expect(within(menu).getByRole('menuitem', { name: /^Projekt$/i })).toBeTruthy()
    expect(within(menu).getByRole('menuitem', { name: /Izvezi DOCX/i })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu', { name: /Dodatne radnje/i })).toBeNull()
  })
})

describe('MobileWorkspaceNav', () => {
  it('marks only the active workspace context and changes context on click', async () => {
    const user = userEvent.setup()
    const onMobileViewChange = vi.fn()

    render(<MobileWorkspaceNav activeMobileView="editor" onMobileViewChange={onMobileViewChange} />)

    const nav = screen.getByRole('navigation', { name: /Radni prostor/i })
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(within(nav).getByRole('button', { name: 'Rukopis' }).getAttribute('aria-current')).toBe('page')

    await user.click(within(nav).getByRole('button', { name: 'Katedra' }))
    expect(onMobileViewChange).toHaveBeenCalledWith('assistant')
  })
})
