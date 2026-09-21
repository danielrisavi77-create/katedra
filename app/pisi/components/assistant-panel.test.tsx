// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

    expect(screen.getByRole('region', { name: /urednik sekcije/i })).toBeTruthy()
    expect(screen.getByText(/ti potvrđuješ svaku izmjenu/i)).toBeTruthy()
  })

  it('lets the user discard a stale proposal', async () => {
    const user = userEvent.setup()
    const onReject = vi.fn()

    render(
      <AssistantPanel
        sectionTitle="Uvod"
        proposal={{
          id: 'proposal-1',
          sectionId: 'section-1',
          action: 'improve',
          baseRevision: 'revision-1',
          proposedText: 'Zastarjeli prijedlog',
          status: 'stale',
          createdAt: '2026-08-15T00:00:00.000Z',
        }}
        busy={false}
        onRun={vi.fn()}
        onAccept={vi.fn()}
        onInsert={vi.fn()}
        onReject={onReject}
        onEdit={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Odbaci' }))
    expect(onReject).toHaveBeenCalledOnce()
  })
})
