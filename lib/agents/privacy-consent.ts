export const AGENT_SNAPSHOT_CONSENT_VERSION = 'agentic-snapshot-v1'
export const AGENT_SNAPSHOT_RETENTION_HOURS = 72
const MAX_CONSENT_AGE_MS = 90 * 24 * 60 * 60 * 1000
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

export interface AgentSnapshotConsentV1 {
  version: typeof AGENT_SNAPSHOT_CONSENT_VERSION
  projectId: string
  acceptedAt: string
}

export type AgentRunPrivacyStatus =
  | 'local'
  | 'temporarily_uploaded'
  | 'deletion_scheduled'
  | 'deleted'
  | 'deletion_failed'

export type AgentRunPrivacyState = {
  status: AgentRunPrivacyStatus
  runId?: string
  expiresAt?: string
  deletedAt?: string
  updatedAt: string
}

export function createAgentSnapshotConsent(projectId: string, now = Date.now()): AgentSnapshotConsentV1 {
  return {
    version: AGENT_SNAPSHOT_CONSENT_VERSION,
    projectId: projectId.trim(),
    acceptedAt: new Date(now).toISOString(),
  }
}

export function validateAgentSnapshotConsent(
  value: unknown,
  projectId: string,
  now = Date.now(),
): { ok: true; value: AgentSnapshotConsentV1 } | { ok: false; error: string } {
  if (!isRecord(value)
    || value.version !== AGENT_SNAPSHOT_CONSENT_VERSION
    || value.projectId !== projectId
    || typeof value.acceptedAt !== 'string') {
    return { ok: false, error: 'Prije pokretanja moraš potvrditi privremeni prijenos rukopisa za ovaj projekt.' }
  }

  const acceptedAt = Date.parse(value.acceptedAt)
  if (!Number.isFinite(acceptedAt) || acceptedAt > now + MAX_CLOCK_SKEW_MS || acceptedAt < now - MAX_CONSENT_AGE_MS) {
    return { ok: false, error: 'Potvrda privatnosti više nije valjana. Pregledaj obavijest i potvrdi je ponovno.' }
  }

  return {
    ok: true,
    value: {
      version: AGENT_SNAPSHOT_CONSENT_VERSION,
      projectId,
      acceptedAt: new Date(acceptedAt).toISOString(),
    },
  }
}

export function agentRunPrivacyStorageKey(projectId: string, runId: string): string {
  return `katedra_agent_privacy_v1:${projectId}:${runId}`
}

export function readStoredAgentSnapshotConsent(projectId: string): AgentSnapshotConsentV1 | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`katedra_agent_consent_v1:${projectId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    const result = validateAgentSnapshotConsent(parsed, projectId)
    return result.ok ? result.value : null
  } catch {
    return null
  }
}

export function storeAgentSnapshotConsent(consent: AgentSnapshotConsentV1): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(`katedra_agent_consent_v1:${consent.projectId}`, JSON.stringify(consent)) } catch {}
}

export function clearStoredAgentSnapshotConsent(projectId: string): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(`katedra_agent_consent_v1:${projectId}`) } catch {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
