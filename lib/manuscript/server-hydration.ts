import { migrateLegacyProject } from './migration'
import { serverStateToManifest } from './server-project'
import type { ManuscriptV1 } from './types'

/** Metadata may initialize an untouched workspace; it never replaces edits. */
export async function loadServerProjectSnapshot(
  initial: ManuscriptV1,
  readCurrent: () => ManuscriptV1 | null,
  fetcher: typeof fetch = fetch,
): Promise<ManuscriptV1 | null> {
  const response = await fetcher(`/api/state?projectId=${encodeURIComponent(initial.projectId)}`, { cache: 'no-store' })
  if (!response.ok) return null
  const state: unknown = await response.json().catch(() => null)
  if (readCurrent() !== initial) return null
  const manifest = serverStateToManifest(initial.projectId, state)
  return manifest ? migrateLegacyProject({ manifest }) : null
}
