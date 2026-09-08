import { createHash, randomUUID } from 'node:crypto'

export interface TrackedUploadClient {
  rpc: (name: string, params: Record<string, unknown>) => PromiseLike<{ data?: unknown; error?: unknown }>
  storage: { from: (bucket: string) => {
    upload: (path: string, body: Uint8Array, options: { contentType: string; cacheControl: string; upsert: boolean }) => PromiseLike<{ error?: unknown }>
    download?: (path: string) => PromiseLike<{ data?: unknown; error?: unknown }>
  } }
}
const hash = (body: Uint8Array) => createHash('sha256').update(body).digest('hex')

export async function trackedPayloadUpload(client: TrackedUploadClient, input: {
  manifestId: string; kind: 'body' | 'manifest'; path: string; body: Uint8Array
}): Promise<boolean> {
  const token = randomUUID()
  const identity = { p_manifest_id: input.manifestId, p_object_kind: input.kind, p_upload_token: token }
  const sha256 = hash(input.body)
  try {
    const started = await client.rpc('begin_agent_payload_upload', { ...identity, p_sha256: sha256, p_bytes: input.body.byteLength })
    if (started.error) return false
    const storage = client.storage.from('katedra-temporary-materials')
    if (started.data === 'stored') {
      const existing = await storage.download?.(input.path)
      if (!existing || existing.error) return false
      const value = existing.data
      const bytes = value instanceof Uint8Array ? value : typeof value === 'string' ? new TextEncoder().encode(value)
        : value instanceof ArrayBuffer ? new Uint8Array(value)
          : value && typeof value === 'object' && 'arrayBuffer' in value && typeof value.arrayBuffer === 'function'
            ? new Uint8Array(await value.arrayBuffer()) : null
      return Boolean(bytes && bytes.byteLength === input.body.byteLength && hash(bytes) === sha256)
    }
    if (started.data !== 'upload') return false
    let succeeded = false
    try {
      const uploaded = await storage.upload(input.path, input.body, { contentType: 'application/json', cacheControl: '0', upsert: false })
      succeeded = !uploaded.error
    } catch { /* The canonical intent remains uncertain until provider evidence exists. */ }
    const finished = await client.rpc('finish_agent_payload_upload', { ...identity, p_succeeded: succeeded })
    return succeeded && !finished.error && finished.data === 'uploaded'
  } catch {
    // Never retry the upload or erase its evidence after an ambiguous response.
    return false
  }
}
