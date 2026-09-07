// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PassDialog } from './pass-dialog'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PassDialog', () => {
  it('does not redirect after the purchase dialog is replaced while checkout is pending', async () => {
    const user = userEvent.setup()
    let finish!: (response: Response) => void
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', fetcher)
    const redirect = vi.fn()
    const props = { open: true, projectId: 'project-1', workType: 's' as const, onClose: vi.fn(), onRedirect: redirect }
    const view = render(<PassDialog {...props} />)
    for (const checkbox of screen.getAllByRole('checkbox')) await user.click(checkbox)
    await user.click(screen.getByRole('button', { name: /nastavi na sigurno plaćanje/i }))
    view.rerender(<PassDialog {...props} projectId="project-2" />)
    await act(async () => { finish(Response.json({ url: 'https://checkout.stripe.test/old-session' })) })
    expect(redirect).not.toHaveBeenCalled()
    expect(screen.getAllByRole('checkbox').every(checkbox => !(checkbox as HTMLInputElement).checked)).toBe(true)
  })

  it('keeps keyboard focus in the legal summary and closes only the inner dialog', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<PassDialog open projectId="project-1" workType="s" onClose={onClose} />)
    const trigger = screen.getByRole('button', { name: 'Uvjete korištenja' })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Sažetak uvjeta korištenja' })
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Zatvori' }))
    await user.tab()
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Zatvori sažetak' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Sažetak uvjeta korištenja' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
  })

  it.each(['reopen', 'project', 'topic', 'package'])('requires fresh consent after purchase context changes: %s', async (change) => {
    const user = userEvent.setup()
    const props = { open: true, projectId: 'project-1', workType: 's' as const, projectTitle: 'Original', onClose: vi.fn() }
    const view = render(<PassDialog {...props} />)
    for (const checkbox of screen.getAllByRole('checkbox')) await user.click(checkbox)
    expect((screen.getByRole('button', { name: /nastavi na sigurno plaćanje/i }) as HTMLButtonElement).disabled).toBe(false)
    if (change === 'reopen') {
      view.rerender(<PassDialog {...props} open={false} />)
      view.rerender(<PassDialog {...props} />)
    } else {
      view.rerender(<PassDialog {...props} projectId={change === 'project' ? 'project-2' : props.projectId} projectTitle={change === 'topic' ? 'Changed' : props.projectTitle} workType={change === 'package' ? 'd' : props.workType} />)
    }
    expect(screen.getAllByRole('checkbox').every(checkbox => !(checkbox as HTMLInputElement).checked)).toBe(true)
    expect((screen.getByRole('button', { name: /nastavi na sigurno plaćanje/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('requires explicit consent and checks out the package for the manuscript type', async () => {
    const user = userEvent.setup()
    const redirect = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.test/session' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <PassDialog
        open
        projectId="project-1"
        workType="d"
        projectTitle="Digitalizacija javne uprave"
        institution="FPZG"
        program="Politologija"
        mentor="Dr. Ime Prezime"
        deadline="2026-12-01"
        onClose={vi.fn()}
        onRedirect={redirect}
      />,
    )

    const submit = screen.getByRole('button', { name: /nastavi na sigurno plaćanje/i })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/129,90/)).toBeTruthy()
    expect(screen.getByText('Digitalizacija javne uprave')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Diplomski Pass za ovaj projekt/i })).toBeTruthy()
    expect(screen.getByText(/Tema ovog projekta bit će zaključana nakon naplate/i)).toBeTruthy()
    expect(screen.queryByText(/odaberi jedan od tri nepovezana/i)).toBeNull()
    expect(screen.getByText(/tema se nakon naplate/i)).toBeTruthy()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    await user.click(checkboxes[0])
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    await user.click(checkboxes[1])
    await user.click(submit)

    expect(fetchMock).toHaveBeenCalledWith('/api/checkout', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        package: 'diplomski',
        projectId: 'project-1',
        topic: 'Digitalizacija javne uprave',
        lockConfirmation: true,
      }),
    }))
    expect(redirect).toHaveBeenCalledWith('https://checkout.stripe.test/session')
  })

  it('closes exactly once when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<PassDialog open projectId="project-1" workType="z" onClose={onClose} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })
})
