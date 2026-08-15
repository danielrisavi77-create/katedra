// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createManuscript, plainTextDocument } from '../../../lib/manuscript/model'
import { ProjectHome } from './project-home'

afterEach(cleanup)

describe('ProjectHome', () => {
  it('renders one primary continuation action with the current stage and word count', () => {
    const manuscript = createManuscript({
      projectId: 'project-1',
      title: 'Digitalizacija javne uprave',
      workType: 'z',
    })
    manuscript.meta = { ...manuscript.meta, currentState: 'draft', materials: ['upute mentora'], mentor: 'Ana Mentor', deadline: '2026-09-15' }
    manuscript.sections = manuscript.sections.map((section) => ({ ...section, content: plainTextDocument('Ovo je stvarni nacrt rada.'), status: 'draft' as const }))

    render(<ProjectHome manuscript={manuscript} passActive syncStatus="synced" onNavigate={vi.fn()} />)

    expect(screen.getAllByRole('button', { name: 'Nastavi' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Nastavi' }).getAttribute('data-primary-action')).toBe('true')
    expect(document.querySelector('.pis-project-stage')?.textContent).toBe('Pisanje')
    expect(screen.getByText(/25 riječi/)).toBeTruthy()
    expect(screen.queryByText(/%/)).toBeNull()
  })

  it('places Literatura between Plan and Pisanje in the active project path', () => {
    const manuscript = createManuscript({ projectId: 'project-1', title: 'Tema rada', workType: 'z' })
    manuscript.meta = { ...manuscript.meta, currentState: 'draft', materials: ['upute'] }
    manuscript.sections = manuscript.sections.map((section) => ({ ...section, content: plainTextDocument('Nacrt rada.'), status: 'draft' as const }))

    render(<ProjectHome manuscript={manuscript} passActive syncStatus="local_only" onNavigate={vi.fn()} />)

    const steps = within(screen.getByRole('region', { name: 'Od teme do predaje' })).getAllByRole('listitem')
    expect(steps.map((step) => step.textContent)).toEqual(['Tema', 'Plan', 'Literatura', 'Pisanje', 'Revizija', 'Lekta', 'Predaja'])
    expect(steps.map((step) => step.getAttribute('data-state'))).toEqual(['complete', 'complete', 'complete', 'active', 'upcoming', 'upcoming', 'upcoming'])
  })

  it('uses a local source as Completion Scan material context', () => {
    const manuscript = createManuscript({ projectId: 'project-1', title: 'Tema rada', workType: 'z' })
    manuscript.meta = { ...manuscript.meta, currentState: 'outline' }
    manuscript.sources = [{ id: 'source-1', title: 'Relevantna literatura', verified: false }]

    render(<ProjectHome manuscript={manuscript} passActive syncStatus="local_only" onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Nastavi' })).toBeTruthy()
    expect(screen.getByText('1 zapis')).toBeTruthy()
    expect(screen.queryByText(/dodati postojeći tekst, upute ili literaturu/)).toBeNull()
  })
})
