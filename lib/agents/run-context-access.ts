import { runContextStoragePaths } from './run-context'
import { isScopedAgentPayload, type AgentPayloadScope } from './payload-scope'
import { loadRunManuscriptContext, type RunPayloadManifestStore, type RunPayloadStorage } from './run-context-loader'

const MAX_DESCRIPTOR_BYTES = 1024 * 1024

/** Worker entry point: retained Storage bytes alone never authorize a run. */
export async function loadActiveRunManuscriptContext(
  manifests: RunPayloadManifestStore,
  storage: RunPayloadStorage,
  scope: AgentPayloadScope & { now?: number },
) {
  const now = scope.now ?? Date.now()
  const paths = runContextStoragePaths(scope.userId, scope.projectId, scope.runId)
  const entries = (await manifests.list(scope.runId, scope.projectId))
    .filter(entry => entry.materialId === 'run-context')
  const entry = entries[0]
  if (entries.length !== 1 || !entry || !isScopedAgentPayload(entry, scope)
    || entry.storagePath !== paths.storagePath || entry.manifestPath !== paths.manifestPath
    || !isActive(entry.expiresAt, now)) {
    throw new Error('Aktivni kontekst rukopisa nije dostupan.')
  }

  const raw = await storage.download(entry.manifestPath)
  const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw) : raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw
  if (bytes.byteLength > MAX_DESCRIPTOR_BYTES) throw new Error('Opis konteksta rukopisa je prevelik.')
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Opis konteksta rukopisa nije valjan.')
  const descriptor = value as Record<string, unknown>
  if (descriptor.schemaVersion !== 1 || descriptor.kind !== 'run-context' || descriptor.materialId !== entry.materialId
    || descriptor.runId !== scope.runId || descriptor.projectId !== scope.projectId
    || descriptor.storagePath !== entry.storagePath || !isActive(descriptor.expiresAt, now)) {
    throw new Error('Opis konteksta rukopisa nije aktivan za ovaj run.')
  }
  return loadRunManuscriptContext(storage, { storagePath: entry.storagePath, projectId: scope.projectId })
}

function isActive(value: unknown, now: number): boolean {
  return typeof value === 'string' && Number.isFinite(now) && Date.parse(value) > now
}
