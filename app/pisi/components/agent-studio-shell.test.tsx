// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createManuscript, plainTextDocument } from '../../../lib/manuscript/model'
import { AgentStudioShell } from './agent-studio-shell'

afterEach(cleanup)

describe('AgentStudioShell', () => {
  it('shows the workshop process and live manuscript preview', () => {
    const manuscript = createManuscript({
      projectId: 'project-1',
      title: 'Digitalna javna uprava',
      workType: 'z',
      now: '2026-08-15T20:00:00.000Z',
    })
    manuscript.sections[0].content = plainTextDocument('Početni tekst rada.')

    render(
      <AgentStudioShell
        manuscript={manuscript}
        passActive
        phase="preparation"
        onOpenWriting={vi.fn()}
      >
        <p>Proces agenata</p>
      </AgentStudioShell>,
    )

    expect(screen.getByRole('heading', { name: 'Radionica Katedre' })).toBeTruthy()
    expect(screen.getByText('Rukopis uživo')).toBeTruthy()
    expect(screen.getByText('Proces agenata')).toBeTruthy()
    expect(screen.getByText('Početni tekst rada.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Otvori rukopis' })).toBeTruthy()
  })
})
