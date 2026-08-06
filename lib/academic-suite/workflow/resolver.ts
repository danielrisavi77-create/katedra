import type { WorkflowLoadResult, WorkflowResolution } from './types'

const LEGACY_COMPAT: WorkflowResolution = {
  workflowAuthority: 'legacy-compat',
  workflow: null,
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
