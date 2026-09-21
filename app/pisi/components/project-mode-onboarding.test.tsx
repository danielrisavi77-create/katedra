// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProjectModeOnboarding } from './project-mode-onboarding'

afterEach(cleanup)

describe('ProjectModeOnboarding', () => {
  it('requires an explicit workspace choice before continuing', () => {
    render(<ProjectModeOnboarding onComplete={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Kako želiš izraditi ovaj rad?' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Radionica rukopisa/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Autonomna izrada/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nastavi' })).toHaveProperty('disabled', true)
  })

  it('starts the selected autonomous workspace', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<ProjectModeOnboarding onComplete={onComplete} />)

    await user.click(screen.getByRole('button', { name: /Autonomna izrada/ }))
    await user.click(screen.getByRole('button', { name: 'Pokreni autonomni workspace' }))

    expect(onComplete).toHaveBeenCalledWith('autonomous')
  })

  it('does not offer an autonomous path while its server contracts are unavailable', () => {
    render(<ProjectModeOnboarding autonomousAvailable={false} onComplete={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Autonomna izrada/ })).toHaveProperty('disabled', true)
    expect(screen.getByText(/sigurni server-side agent ugovori/i)).toBeTruthy()
  })

})
