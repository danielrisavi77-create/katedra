import type { RunPayloadManifest } from './run-context-loader'

export interface AgentPayloadScope {
  userId: string
  projectId: string
  runId: string
  bucket: string
}

export function isScopedAgentPayload(entry: RunPayloadManifest, scope: AgentPayloadScope): boolean {
  if (entry.projectId !== scope.projectId || entry.runId !== scope.runId || entry.storageBucket !== scope.bucket) return false
  const prefix = `${scope.userId}/${scope.projectId}/`
  return isSafePath(entry.storagePath, prefix) && isSafePath(entry.manifestPath, prefix)
}

function isSafePath(value: unknown, prefix: string): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1_000) return false
  if (!value.startsWith(prefix) || value.includes('\\')) return false
  const segments = value.split('/')
  return !segments.includes('.') && !segments.includes('..') && !segments.includes('')
}
