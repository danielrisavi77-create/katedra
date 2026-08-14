import { describe, expect, it } from 'vitest'

import { shouldShowManuscriptOnboarding } from './onboarding-state'

describe('manuscript onboarding state', () => {
  it('shows project setup for an existing manuscript until its details are explicitly confirmed', () => {
    expect(shouldShowManuscriptOnboarding({
      hasStoredManuscript: true,
      hasLegacyOnboardingMarker: true,
      hasWorkspaceReadyMarker: true,
      hasProjectSetupConfirmed: false,
    })).toBe(true)
  })

  it('opens a manuscript directly only after its project setup has been confirmed', () => {
    expect(shouldShowManuscriptOnboarding({
      hasStoredManuscript: true,
      hasProjectSetupConfirmed: true,
    })).toBe(false)
  })
})
