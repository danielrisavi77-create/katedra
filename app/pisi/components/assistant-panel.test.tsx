// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AssistantPanel } from './assistant-panel'
import type { CapabilityExplanation } from '../../../lib/academic-suite/process-facts'

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

  it('shows why a policy-gated action is allowed or blocked and links to its source', async () => {
    const user = userEvent.setup()
    const policy: CapabilityExplanation = {
      capability: 'generate_large_sections',
      label: 'Generiranje poglavlja/dijelova rada',
      stance: 'banned',
      effective: 'blocked',
      reason: 'Službeni zapis ovu AI radnju izričito zabranjuje.',
      obligations: [],
      source: { t: 'FPZG AI smjernice', u: 'https://www.fpzg.unizg.hr/policy.pdf' },
      sourceFactId: 'fpzg-policy',
      sourceStatus: 'verified',
      verifiedDate: '2026-08-22',
      requirements: {
        aiDisclosure: { required: true, note: 'Obavezna izjava.' },
        mentorApproval: { required: true, scope: 'završni i diplomski radovi', note: 'Konzultacija s mentorom.' },
      },
    }

    render(
      <AssistantPanel
        sectionTitle="Uvod"
        proposal={null}
        busy={false}
        policyExplanations={{ generate_large_sections: policy }}
        onRun={vi.fn()}
        onAccept={vi.fn()}
        onInsert={vi.fn()}
        onReject={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    await user.click(screen.getAllByRole('button', { name: /zašto je ova ai radnja/i })[0])

    expect(screen.getByText(policy.reason)).toBeTruthy()
    expect(screen.getByText(/mentor approval: završni i diplomski radovi/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /otvori službeni izvor/i }).getAttribute('href')).toBe(policy.source.u)
    expect(screen.getByText(/blokirano/i)).toBeTruthy()
  })

  it('keeps the policy explanation visible when the assistant opens on helpers', async () => {
    const user = userEvent.setup()
    const policy: CapabilityExplanation = {
      capability: 'generate_large_sections',
      label: 'Generiranje poglavlja/dijelova rada',
      stance: 'banned',
      effective: 'blocked',
      reason: 'Generiranje poglavlja nije dopušteno.',
      obligations: [],
      source: { t: 'FPZG AI smjernice', u: 'https://www.fpzg.unizg.hr/policy.pdf' },
      verifiedDate: '2026-08-22',
    }

    render(
      <AssistantPanel
        sectionTitle="Uvod"
        proposal={null}
        busy={false}
        initialTab="helpers"
        policyExplanations={{ generate_large_sections: policy }}
        onRun={vi.fn()}
        onAccept={vi.fn()}
        onInsert={vi.fn()}
        onReject={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /zašto je ova ai radnja/i }))
    expect(screen.getByText(policy.reason)).toBeTruthy()
  })
})
