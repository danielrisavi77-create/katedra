// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PassDialog } from './pass-dialog'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PassDialog', () => {
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
