// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgentTeamSelector } from './agent-team-selector'

afterEach(cleanup)

describe('AgentTeamSelector', () => {
  it('does not present unavailable web research as a selectable option', () => {
    render(
      <AgentTeamSelector
        mode="guided"
        sourcePolicy="uploaded_only"
        onModeChange={vi.fn()}
        onSourcePolicyChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('radio', { name: /Šira pretraga/ })).toHaveProperty('disabled', true)
    expect(screen.getByText(/web adapter/i)).toBeTruthy()
  })
})
