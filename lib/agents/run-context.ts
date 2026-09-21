import { validateManuscriptBackup } from '../manuscript/backup-validation'
import type { ManuscriptV1 } from '../manuscript/types'

export const MAX_AGENT_CONTEXT_BYTES = 5 * 1024 * 1024

export function runContextStoragePaths(userId: string, projectId: string, runId: string, revision?: string): { storagePath: string; manifestPath: string } {
  if (revision !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(revision)) throw new Error('Invalid context revision')
  const prefix = `${userId}/${projectId}/${runId}${revision ? `/contexts/${revision}` : ''}`
  return {
    storagePath: `${prefix}/manuscript-context.json`,
    manifestPath: `${prefix}/manuscript-context.manifest.json`,
  }
}

export type AgentRunContextFailure = 'invalid' | 'project_mismatch' | 'too_large'
export type AgentRunContextResult =
  | { ok: true; manuscript: ManuscriptV1 }
  | { ok: false; reason: AgentRunContextFailure; error: string }

export function validateAgentRunContext(value: unknown, projectId: string, serializedBytes?: number): AgentRunContextResult {
  if (serializedBytes !== undefined && serializedBytes > MAX_AGENT_CONTEXT_BYTES) {
    return { ok: false, reason: 'too_large', error: 'Kontekst rukopisa je prevelik.' }
  }
  if (!isRecord(value) || !('manuscript' in value)) {
    return { ok: false, reason: 'invalid', error: 'Nedostaje snapshot rukopisa.' }
  }

  const result = validateManuscriptBackup(value.manuscript, projectId)
  if (result.ok === false) return { ok: false, reason: result.reason, error: result.error }

  if (serializedBytes === undefined) {
    let measuredBytes = 0
    try {
      measuredBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength
    } catch {
      return { ok: false, reason: 'invalid', error: 'Snapshot rukopisa nije moguće serijalizirati.' }
    }
    if (measuredBytes > MAX_AGENT_CONTEXT_BYTES) {
      return { ok: false, reason: 'too_large', error: 'Kontekst rukopisa je prevelik.' }
    }
  }

  return { ok: true, manuscript: result.value }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
