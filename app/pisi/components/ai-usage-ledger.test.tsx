// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AiUsageLedger } from './ai-usage-ledger'
import type { AiUsageLedgerV1 } from '../../../lib/agents/usage-ledger'

afterEach(() => cleanup())

describe('AiUsageLedger', () => {
  it('keeps operational details collapsed and exposes a safe metadata-only export', async () => {
    const user = userEvent.setup()
    const onDownload = vi.fn()
    const ledger: AiUsageLedgerV1 = {
      schemaVersion: 1,
      projectId: 'project-1',
      runId: 'run-1',
      mode: 'autonomous',
      generatedAt: '2026-08-16T10:02:00.000Z',
      totals: { calls: 1, inputTokens: 12, outputTokens: 34, pendingBilling: 0 },
      rows: [{
        stepId: 'step-1',
        agent: 'writing',
        phase: 'Pisanje',
        verifier: 'writing_verifier',
        attempt: 1,
        status: 'verified',
        provider: 'configured-provider',
        inputTokens: 12,
        outputTokens: 34,
        billingState: 'settled',
        applied: 'accepted',
        occurredAt: '2026-08-16T10:01:00.000Z',
      }],
    }

    render(<AiUsageLedger ledger={ledger} onDownload={onDownload} />)

    const details = screen.getByRole('group', { name: 'AI zapis' }) as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(screen.getByText('1 poziv')).toBeTruthy()
    expect(screen.getByText('12 ulaznih · 34 izlaznih tokena')).toBeTruthy()

    await user.click(screen.getByText('AI zapis'))
    const view = within(details)
    expect(view.getByRole('columnheader', { name: 'Agent' })).toBeTruthy()
    expect(view.getByText('configured-provider')).toBeTruthy()
    expect(view.getByText('Prihvaćeno')).toBeTruthy()
    await user.click(view.getByRole('button', { name: 'Preuzmi AI zapis (.json)' }))
    expect(onDownload).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/prompt|rukopis|citat/i)).toBeNull()
  })
})
