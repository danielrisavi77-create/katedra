export function shouldShowManuscriptOnboarding({
  hasProjectSetupConfirmed = false,
}: {
  hasStoredManuscript?: boolean
  hasWorkspaceReadyMarker?: boolean
  hasLegacyOnboardingMarker?: boolean
  hasProjectSetupConfirmed?: boolean
}): boolean {
  return !hasProjectSetupConfirmed
}
