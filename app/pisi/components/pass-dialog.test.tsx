// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PassDialog } from './pass-dialog'

const verifiedAcademicContext = {
  unitId: 'fpzg',
  profileId: 'fpzg-politologija-diplomski',
  institutionName: 'FPZG',
  institutionLabel: 'Sveuciliste u Zagrebu',
  profileLabel: 'FPZG diplomski',
  workType: 'd' as const,
  status: 'verified' as const,
  verifiedAt: '2026-06-28',
  wordRange: { min: 10000, max: 12000 },
  minimumReferences: 15,
  minimumBooks: 3,
  citationStyle: 'FPZG autor-godina',
  requiredSections: [],
  manualChecks: [],
  facts: [],
  submissionFacts: [],
  sources: [{ title: 'FPZG upute', url: 'https://fpzg.unizg.hr/upute' }],
  aiPolicy: { mode: 'full' as const, claims: [] },
  capabilities: { facultyCoaching: true, paidPass: true, webResearch: true, autonomousRun: true },
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PassDialog', () => {
  it('keeps checkout disabled until a verified academic context is available', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<PassDialog open projectId="project-1" workType="d" onClose={vi.fn()} />)

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0])
    await user.click(checkboxes[1])

    expect((screen.getByRole('button', { name: /Nastavi na sigurno/i }) as HTMLButtonElement).disabled).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
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
        academicContext={verifiedAcademicContext}
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
    for (const label of ['Projekt i Completion Plan', 'Rukopis po sekcijama', 'Kontekstualna AI pomoć', 'Izvori i verifikacija', 'Mentorovi zadaci', 'Lokalne verzije', 'AI zapis', 'Lekta handoff']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.queryByText(/istraživački dizajn|simulator obrane|više revizijskih krugova/i)).toBeNull()

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

  it('shows verified profile evidence and blocks a Pass claim for partial rules', () => {
    render(
      <PassDialog
        open projectId="project-1" workType="d" onClose={vi.fn()}
        academicContext={{
          unitId: 'fpzg', profileId: 'fpzg-politologija-diplomski', institutionName: 'FPZG', institutionLabel: 'Sveučilište u Zagrebu', profileLabel: 'FPZG diplomski', workType: 'd', status: 'partial', verifiedAt: '2026-06-28',
          requiredSections: [], manualChecks: [], facts: [], submissionFacts: [], sources: [], aiPolicy: { mode: 'generic', claims: [] }, capabilities: { facultyCoaching: false, paidPass: false, webResearch: false, autonomousRun: false },
        }}
      />,
    )

    expect(screen.getByText(/djelomično potvrđena/i)).toBeTruthy()
    expect(screen.getByText(/nije moguće kupiti pass/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: /nastavi na sigurno plaćanje/i }) as HTMLButtonElement).disabled).toBe(true)
  })
})
