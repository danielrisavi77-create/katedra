// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AssistantPanel } from './assistant-panel'

afterEach(cleanup)

describe('AssistantPanel', () => {
  it('exposes Katedra as a labeled writing context with confirmation guidance', () => {
    render(
      <AssistantPanel
        sectionTitle="Uvod"
        proposal={null}
        busy={false}
        onRun={vi.fn()}
        onAccept={vi.fn()}
        onInsert={vi.fn()}
        onReject={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByRole('region', { name: /katedra urednik/i })).toBeTruthy()
    expect(screen.getByText(/ti potvrđuješ svaku izmjenu/i)).toBeTruthy()
  })
})
