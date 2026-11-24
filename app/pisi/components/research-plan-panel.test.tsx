// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createEmptyResearchPlan } from '../../../lib/research-plan/validation'
import { ResearchPlanPanel } from './research-plan-panel'

afterEach(() => cleanup())

describe('ResearchPlanPanel', () => {
  it('renders the canvas and methodology fields', () => {
    render(<ResearchPlanPanel plan={createEmptyResearchPlan('project-1')} onChange={vi.fn()} onTransition={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Istraživački plan' })).toBeTruthy()
    expect(screen.getByLabelText('Problem')).toBeTruthy()
    expect(screen.getByLabelText('Cilj istraživanja')).toBeTruthy()
    expect(screen.getByLabelText('Dizajn istraživanja')).toBeTruthy()
    expect(screen.getByLabelText('Etika')).toBeTruthy()
    expect(screen.getByText(/Sprema se samo na ovom uređaju/)).toBeTruthy()
  })

  it('emits field edits and repeated item additions', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const plan = createEmptyResearchPlan('project-1')

    render(<ResearchPlanPanel plan={plan} onChange={onChange} onTransition={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'Problem rada' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ design: expect.objectContaining({ problem: 'Problem rada' }) }))

    await user.click(screen.getByRole('button', { name: /Dodaj hipotezu/ }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ design: expect.objectContaining({ hypotheses: [expect.objectContaining({ value: '' })] }) }))
  })

  it('delegates review and approval transitions', async () => {
    const user = userEvent.setup()
    const onTransition = vi.fn()
    const plan = completeDraftPlan()
    render(<ResearchPlanPanel plan={plan} onChange={vi.fn()} onTransition={onTransition} />)

    await user.click(screen.getByRole('button', { name: 'Pošalji na pregled' }))
    expect(onTransition).toHaveBeenCalledWith('review')
  })
})

function completeDraftPlan() {
  const plan = createEmptyResearchPlan('project-1')
  return {
    ...plan,
    status: 'draft' as const,
    design: { ...plan.design, problem: 'Problem', goal: 'Cilj', researchQuestion: 'Pitanje' },
    methodology: { design: 'Dizajn', sample: 'Uzorak', operationalization: 'Operacionalizacija', instrument: 'Instrument', analysis: 'Analiza', limitations: 'Ograničenja', ethics: 'Etika' },
  }
}
