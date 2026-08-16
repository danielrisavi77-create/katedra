export const DEFAULT_RETRY_AFTER_SECONDS = 60

export function parseRetryAfter(value, now = Date.now()) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed)
    return Number.isSafeInteger(seconds) ? seconds : null
  }

  const timestamp = Date.parse(trimmed)
  if (!Number.isFinite(timestamp)) return null

  return Math.max(0, Math.ceil((timestamp - now) / 1000))
}

export function retryAtFromSeconds(seconds, now = Date.now()) {
  const safeSeconds = Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : 0
  return new Date(now + safeSeconds * 1000).toISOString()
}
