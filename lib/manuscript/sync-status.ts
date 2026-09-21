import type { LegacyWorkType, ManuscriptMetaV1 } from './types'

export type SyncStatus = 'local_only' | 'syncing' | 'synced' | 'failed'

export type SyncInput = {
  projectId: string
  workType: LegacyWorkType
  title: string
  meta: ManuscriptMetaV1
}

export type SyncResult = {
  status: Exclude<SyncStatus, 'syncing'>
  responseStatus?: number
  canonicalProjectId?: string
}

type SyncFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export async function syncMetadata(input: SyncInput, loggedIn: boolean, fetcher: SyncFetcher = fetch): Promise<SyncResult> {
  if (!loggedIn) return { status: 'local_only' }

  try {
    const response = await fetcher('/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: input.projectId,
        guestProjectId: input.projectId,
        workType: input.workType,
        topic: input.title,
        unitId: input.meta.unitId || '',
        profileId: input.meta.profileId || '',
        deadline: input.meta.deadline || '',
        fullSyncConsent: false,
      }),
    })
    if (!response.ok) return { status: 'failed', responseStatus: response.status }
    const payload = await response.json().catch(() => null) as { projectId?: unknown; guestProjectId?: unknown } | null
    const responseProjectId = typeof payload?.projectId === 'string' ? payload.projectId.trim() : ''
    const responseGuestProjectId = typeof payload?.guestProjectId === 'string' ? payload.guestProjectId.trim() : ''
    if (!responseProjectId || (responseProjectId !== input.projectId && responseGuestProjectId !== input.projectId)) {
      return { status: 'failed', responseStatus: response.status }
    }
    return responseProjectId === input.projectId
      ? { status: 'synced', responseStatus: response.status }
      : { status: 'synced', responseStatus: response.status, canonicalProjectId: responseProjectId }
  } catch {
    return { status: 'failed' }
  }
}
