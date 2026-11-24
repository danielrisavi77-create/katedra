// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DeadlineReminderBanner } from './deadline-reminder-banner'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

function deadlineAfter(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

describe('DeadlineReminderBanner', () => {
  it('remains available for explicit email opt-in on a configured reminder day', () => {
    const deadline = deadlineAfter(7)

    render(<DeadlineReminderBanner projectId="project-1" deadline={deadline} stage="writing" authenticated onNavigate={vi.fn()} />)

    expect(screen.getByText('Rok je za 7 dana')).toBeTruthy()
    expect(screen.getByLabelText(/Želim i e-mail podsjetnik/)).toBeTruthy()
  })

  it('does not show a banner outside the 7, 3 or 1 day reminders', () => {
    const deadline = deadlineAfter(6)

    render(<DeadlineReminderBanner projectId="project-1" deadline={deadline} stage="writing" authenticated onNavigate={vi.fn()} />)

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('allows the user to revoke an email reminder after opting in', async () => {
    const user = userEvent.setup()
    const deadline = deadlineAfter(7)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    render(<DeadlineReminderBanner projectId="project-1" deadline={deadline} stage="writing" authenticated onNavigate={vi.fn()} />)
    await user.click(screen.getByLabelText(/Želim i e-mail podsjetnik/))
    expect(await screen.findByText('E-mail podsjetnik je uključen.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Isključi e-mail podsjetnik' }))
    expect(fetchMock).toHaveBeenLastCalledWith('/api/reminders/deadline?projectId=project-1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('restores an existing email reminder after the banner mounts again', async () => {
    const deadline = deadlineAfter(7)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ enabled: true, deadline }), { status: 200 }))

    render(<DeadlineReminderBanner projectId="project-1" deadline={deadline} stage="writing" authenticated onNavigate={vi.fn()} />)

    expect(await screen.findByText('E-mail podsjetnik je uključen.')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith('/api/reminders/deadline?projectId=project-1', { cache: 'no-store' })
  })
})
