import type { WorkflowLoadResult, WorkflowResolution } from './types'

const LEGACY_COMPAT: WorkflowResolution = {
  workflowAuthority: 'legacy-compat',
  workflow: null,
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function canonicalProjectCandidate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim()
  return UUID_PATTERN.test(id) ? id : null
}

export function resolveWorkflowForLegacySelection(
  candidateProjectId: string | null | undefined,
  loadResult: WorkflowLoadResult | null,
): WorkflowResolution {
  if (!candidateProjectId?.trim()) return LEGACY_COMPAT
  if (!loadResult || loadResult.kind !== 'found') return LEGACY_COMPAT

  return {
    workflowAuthority: 'completion',
    workflow: loadResult.workflow,
  }
}
