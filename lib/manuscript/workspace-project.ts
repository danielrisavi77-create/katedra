export type WorkspaceProjectManifest = Record<string, unknown>

export type WorkspaceProjectSelection = {
  projectId: string | null
  manifest: WorkspaceProjectManifest
  useLegacyState: boolean
}

export function selectWorkspaceProject({
  requestedProjectId,
  localManifest,
  fallbackProjectId,
}: {
  requestedProjectId?: string | null
  localManifest?: WorkspaceProjectManifest | null
  fallbackProjectId?: string | null
}): WorkspaceProjectSelection {
  const requested = normalizeProjectId(requestedProjectId)
  const local = normalizeProjectId(localManifest?.projectId)

  if (requested) {
    if (requested === local && localManifest) {
      return { projectId: requested, manifest: localManifest, useLegacyState: true }
    }
    return { projectId: requested, manifest: { projectId: requested }, useLegacyState: false }
  }

  const projectId = local || normalizeProjectId(fallbackProjectId)
  return {
    projectId,
    manifest: localManifest || (projectId ? { projectId } : {}),
    useLegacyState: true,
  }
}

function normalizeProjectId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized && normalized.length <= 200 ? normalized : null
}
