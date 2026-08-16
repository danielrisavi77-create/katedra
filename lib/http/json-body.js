export const JSON_BODY_LIMITS = Object.freeze({
  auth: 16 * 1024,
  account: 16 * 1024,
  checkout: 32 * 1024,
  withdrawal: 32 * 1024,
  state: 1 * 1024 * 1024,
  agentRun: 6 * 1024 * 1024,
  worker: 64 * 1024,
  chat: 32 * 1024 * 1024,
  webhook: 2 * 1024 * 1024,
})

const DEFAULT_MAX_BYTES = JSON_BODY_LIMITS.auth

/**
 * Reads and parses a JSON request without allowing an unbounded body to be
 * accumulated in memory. The content-length header is only an early check;
 * the stream is still counted because chunked requests may omit it.
 */
export async function readJsonBody(request, maxBytes = DEFAULT_MAX_BYTES) {
  const limit = Number.isSafeInteger(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_MAX_BYTES
  const contentLength = Number(request?.headers?.get?.('content-length') || '')
  if (Number.isFinite(contentLength) && contentLength > limit) return tooLarge()

  try {
    const bytes = await readLimitedBytes(request, limit)
    if (bytes === null) return tooLarge()
    const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    return { ok: true, value: parsed }
  } catch {
    return { ok: false, status: 400, error: 'Neispravan zahtjev.' }
  }
}

export async function readTextBody(request, maxBytes = DEFAULT_MAX_BYTES) {
  const limit = Number.isSafeInteger(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_MAX_BYTES
  const contentLength = Number(request?.headers?.get?.('content-length') || '')
  if (Number.isFinite(contentLength) && contentLength > limit) return tooLarge()

  try {
    const bytes = await readLimitedBytes(request, limit)
    if (bytes === null) return tooLarge()
    return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  } catch {
    return { ok: false, status: 400, error: 'Neispravan zahtjev.' }
  }
}

async function readLimitedBytes(request, limit) {
  const reader = request?.body?.getReader?.()
  if (!reader) {
    const raw = await request.text()
    const bytes = new TextEncoder().encode(raw)
    return bytes.byteLength > limit ? null : bytes
  }

  const chunks = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      const chunk = next.value instanceof Uint8Array ? next.value : new Uint8Array(next.value || [])
      total += chunk.byteLength
      if (total > limit) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock?.()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function tooLarge() {
  return { ok: false, status: 413, error: 'Zahtjev je prevelik.' }
}
