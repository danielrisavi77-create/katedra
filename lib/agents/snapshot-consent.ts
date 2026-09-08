export const SNAPSHOT_CONSENT_VERSION = 'agentic-snapshot-v1'

export function hasSnapshotConsent(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const consent = value as Record<string, unknown>
  return consent.accepted === true && consent.version === SNAPSHOT_CONSENT_VERSION
}

export async function recordSnapshotConsent(
  db: { rpc: (name: string, params: Record<string, unknown>) => PromiseLike<{ error?: unknown }> },
  scope: { userId: string; projectId: string; runId: string },
  now: () => Date = () => new Date(),
): Promise<boolean> {
  try {
    const result = await db.rpc('record_agent_run_snapshot_consent', {
      p_user_id: scope.userId, p_project_id: scope.projectId, p_run_id: scope.runId,
      p_consent_version: SNAPSHOT_CONSENT_VERSION, p_consent_at: now().toISOString(),
    })
    return !result.error
  } catch {
    return false
  }
}
