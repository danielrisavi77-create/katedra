// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
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
})
