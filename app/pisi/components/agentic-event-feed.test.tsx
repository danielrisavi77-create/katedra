// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { RunStudioEvent } from '../../../lib/agents/run-studio'
import { AgenticEventFeed } from './agentic-event-feed'

const events: RunStudioEvent[] = [
  {
    id: 'active',
    actor: 'katedra',
    kind: 'step_active',
    status: 'active',
    title: 'Katedra piše poglavlje Uvod',
    summary: 'Nakon pisanja slijedi provjera rezultata.',
    sectionId: 'intro',
    attempt: 1,
  },
  {
    id: 'source',
    actor: 'verifier',
    kind: 'source_verified',
    status: 'complete',
    title: 'Izvor je provjeren: Ustav Republike Hrvatske',
    summary: 'Izvor je dostupan kao dokaz uz prijedlog.',
    sources: [{ id: 'source-1', title: 'Ustav Republike Hrvatske', url: 'https://example.test/ustav', verified: true }],
  },
]

describe('AgenticEventFeed', () => {
  afterEach(() => cleanup())

  it('shows actors, live event state and verified source links', () => {
    render(<AgenticEventFeed events={events} onOpenSection={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Dnevnik nastanka rada' })).toBeTruthy()
    expect(screen.getByText('Katedra radi')).toBeTruthy()
    expect(screen.getByText('Provjera')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'https://example.test/ustav' })).toBeTruthy()
  })

  it('does not render unsafe source URLs as links', () => {
    render(<AgenticEventFeed events={[{
      ...events[1],
      id: 'unsafe-source',
      sources: [{ id: 'unsafe', title: 'Nepouzdan izvor', url: 'javascript:alert(1)', verified: true }],
    }]} onOpenSection={vi.fn()} />)

    expect(screen.queryByRole('link', { name: 'javascript:alert(1)' })).toBeNull()
    expect(screen.getByText('Nepouzdan izvor')).toBeTruthy()
  })

  it('lets the user jump from an event to its manuscript section', async () => {
    const user = userEvent.setup()
    const onOpenSection = vi.fn()
    render(<AgenticEventFeed events={events} onOpenSection={onOpenSection} />)

    await user.click(screen.getByRole('button', { name: 'Otvori Uvod u rukopisu' }))
    expect(onOpenSection).toHaveBeenCalledWith('intro')
  })
})
