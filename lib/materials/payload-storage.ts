import { trackedPayloadUpload, type TrackedUploadClient } from '../agents/tracked-upload'
import { MATERIAL_CONSENT_VERSION } from './consent'
import type { MaterialAssetV1 } from './types'

const MAX_RETENTION = 72 * 60 * 60 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function storeMaterialPayload(db: TrackedUploadClient, input: {
  userId: string; projectId: string; runId?: string; asset: MaterialAssetV1; body: Uint8Array
}): Promise<{ ok: false } | { ok: true; asset: MaterialAssetV1; manifestId: string; storagePath: string; manifestPath: string }> {
  try {
    const allocated = await db.rpc('reserve_material_payload', {
      p_user_id: input.userId, p_project_id: input.projectId, p_run_id: input.runId || null,
      p_material_id: input.asset.id, p_consent_version: MATERIAL_CONSENT_VERSION,
    })
    const row = Array.isArray(allocated.data) ? allocated.data[0] : null
    const prefix = `${input.userId}/${input.projectId}/${input.asset.id}`
    if (allocated.error || !row || !UUID.test(row.manifest_id)
      || row.storage_path !== `${prefix}-body` || row.manifest_path !== `${prefix}.manifest.json`) return { ok: false }
    const createdAt = Date.parse(row.created_at)
    const expiresAt = Date.parse(row.expires_at)
    const consentAt = Date.parse(row.consent_at)
    if (![createdAt, expiresAt, consentAt].every(Number.isFinite) || consentAt !== createdAt
      || expiresAt <= Date.now() || expiresAt > createdAt + MAX_RETENTION) return { ok: false }
    const asset: MaterialAssetV1 = {
      ...input.asset, expiresAt: new Date(expiresAt).toISOString(),
      storageConsent: { version: MATERIAL_CONSENT_VERSION, acceptedAt: new Date(consentAt).toISOString() },
    }
    if (!await trackedPayloadUpload(db, {
      manifestId: row.manifest_id, kind: 'body', path: row.storage_path, body: input.body, contentType: asset.mimeType,
    })) return { ok: false }
    if (!await trackedPayloadUpload(db, {
      manifestId: row.manifest_id, kind: 'manifest', path: row.manifest_path,
      body: new TextEncoder().encode(JSON.stringify(asset)),
    })) return { ok: false }
    const published = await db.rpc('complete_material_payload', {
      p_user_id: input.userId, p_project_id: input.projectId, p_manifest_id: row.manifest_id,
    })
    if (published.error || published.data !== row.manifest_id) return { ok: false }
    return { ok: true, asset, manifestId: row.manifest_id, storagePath: row.storage_path, manifestPath: row.manifest_path }
  } catch {
    // An unknown upload/publication response must retain its canonical evidence.
    return { ok: false }
  }
}
