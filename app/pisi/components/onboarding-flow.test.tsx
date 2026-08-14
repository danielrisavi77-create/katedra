// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OnboardingFlow } from './onboarding-flow'
import { ThemeProvider } from '../../theme-provider'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const academicPack = {
  units: [
    { id: 'fpzg', name: 'Fakultet političkih znanosti', inst: 'Sveučilište u Zagrebu', profiles: ['fpzg-politologija-zavrsni', 'fpzg-novinarstvo-zavrsni-tekst'] },
  ],
  profiles: [
    { id: 'fpzg-politologija-zavrsni', unitId: 'fpzg', label: 'FPZG · prijediplomska Politologija · završni rad', workTypes: ['final'] },
    { id: 'fpzg-novinarstvo-zavrsni-tekst', unitId: 'fpzg', label: 'FPZG · prijediplomsko Novinarstvo · završni rad · tekstualni', workTypes: ['final'] },
  ],
}

describe('OnboardingFlow', () => {
  it('collects a new project in three focused steps', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<ThemeProvider><OnboardingFlow initialTip="z" onComplete={onComplete} /></ThemeProvider>)

    await user.click(screen.getByRole('button', { name: /novi rad/i }))
    await user.type(screen.getByLabelText(/fakultet ili ustanova/i), 'FPZG')
    await user.click(screen.getByRole('button', { name: /dalje/i }))
    await user.type(screen.getByLabelText(/^tema rada/i), 'Digitalizacija javne uprave')
    await user.type(screen.getByLabelText(/mentor/i), 'Ana Horvat')
    await user.click(screen.getByRole('button', { name: /otvori rukopis/i }))

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      startMode: 'new',
      workType: 'z',
      institution: 'FPZG',
      title: 'Digitalizacija javne uprave',
      mentor: 'Ana Horvat',
    }))
  })

  it('accepts pasted text for an existing draft without offering DOCX parsing', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<ThemeProvider><OnboardingFlow onComplete={onComplete} /></ThemeProvider>)

    await user.click(screen.getByRole('button', { name: /imam tekst/i }))
    await user.click(screen.getByRole('button', { name: /završni/i }))
    await user.click(screen.getByRole('button', { name: /dalje/i }))
    await user.type(screen.getByLabelText(/postojeći tekst/i), 'Ovo je postojeći nacrt.')
    await user.click(screen.getByRole('button', { name: /otvori rukopis/i }))

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      startMode: 'existing',
      importedText: 'Ovo je postojeći nacrt.',
    }))
    expect(screen.queryByText(/učitaj docx/i)).toBeNull()
  })

  it('keeps legacy project details visible for confirmation before opening the workspace', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider><OnboardingFlow
          initialValues={{
            workType: 'd',
            institution: 'FPZG',
            title: 'Digitalizacija javne uprave',
            mentor: 'Ana Horvat',
            deadline: '2026-09-15',
          }}
          onComplete={vi.fn()}
        /></ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: /novi rad/i }))
    expect((screen.getByLabelText(/fakultet ili ustanova/i) as HTMLInputElement).value).toBe('FPZG')
    await user.click(screen.getByRole('button', { name: /dalje/i }))

    expect((screen.getByLabelText(/^tema rada/i) as HTMLInputElement).value).toBe('Digitalizacija javne uprave')
    expect((screen.getByLabelText(/mentor/i) as HTMLInputElement).value).toBe('Ana Horvat')
    expect((screen.getByLabelText(/rok predaje/i) as HTMLInputElement).value).toBe('2026-09-15')
  })

  it('matches FPZG, filters its study profiles and returns canonical catalog IDs', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => academicPack }))
    render(<ThemeProvider><OnboardingFlow onComplete={onComplete} /></ThemeProvider>)

    await user.click(screen.getByRole('button', { name: /novi rad/i }))
    const faculty = screen.getByLabelText(/fakultet ili ustanova/i)
    await user.type(faculty, 'FPZG')
    await user.click(await screen.findByRole('option', { name: /fakultet političkih znanosti/i }))
    await user.click(screen.getByLabelText(/smjer.*studij/i))
    await user.click(await screen.findByRole('option', { name: /^politologija$/i }))
    await user.click(screen.getByRole('button', { name: /dalje/i }))
    await user.click(screen.getByRole('button', { name: /otvori rukopis/i }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      institution: 'Fakultet političkih znanosti',
      program: 'FPZG · prijediplomska Politologija · završni rad',
      unitId: 'fpzg',
      profileId: 'fpzg-politologija-zavrsni',
    })))
  })

  it('keeps faculty and study program editable when the catalog has no match', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => academicPack }))
    render(<ThemeProvider><OnboardingFlow onComplete={onComplete} /></ThemeProvider>)

    await user.click(screen.getByRole('button', { name: /novi rad/i }))
    await user.type(screen.getByLabelText(/fakultet ili ustanova/i), 'Vlastita ustanova')
    await user.type(screen.getByLabelText(/smjer.*studij/i), 'Vlastiti program')
    await user.click(screen.getByRole('button', { name: /dalje/i }))
    await user.click(screen.getByRole('button', { name: /otvori rukopis/i }))

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      institution: 'Vlastita ustanova',
      program: 'Vlastiti program',
      unitId: '',
      profileId: '',
    }))
  })

  it('automatically reveals compact FPZG study choices after typing its acronym', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => academicPack }))
    render(<ThemeProvider><OnboardingFlow onComplete={vi.fn()} /></ThemeProvider>)

    await user.click(screen.getByRole('button', { name: /novi rad/i }))
    await user.type(screen.getByLabelText(/fakultet ili ustanova/i), 'FPZG')
    const program = screen.getByLabelText(/smjer.*studij/i)
    await user.click(program)

    expect(await screen.findByRole('option', { name: /^Politologija$/i })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Novinarstvo — tekstualni/i })).toBeTruthy()
  })

  it('supports keyboard selection and escape in academic catalog comboboxes', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => academicPack }))
    render(<ThemeProvider><OnboardingFlow onComplete={vi.fn()} /></ThemeProvider>)

    await user.click(screen.getByRole('button', { name: /novi rad/i }))
    const faculty = screen.getByLabelText(/fakultet ili ustanova/i)
    await user.type(faculty, 'FPZG')
    await user.keyboard('{ArrowDown}')
    const activeOption = faculty.getAttribute('aria-activedescendant')
    expect(activeOption).toBeTruthy()
    expect(activeOption).toMatch(/option/)
    await user.keyboard('{Enter}')
    expect((faculty as HTMLInputElement).value).toMatch(/fakultet politi/i)

    const program = screen.getByLabelText(/smjer.*studij/i)
    await user.click(program)
    await user.keyboard('{ArrowDown}{Enter}')
    expect((program as HTMLInputElement).value).toMatch(/politologija/i)
    await user.click(program)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
