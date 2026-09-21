const WINDOW_MS = 10 * 60_000
const MAX_REQUESTS_PER_WINDOW = 3
const buckets = new Map()
const idempotencyKeys = new Map()

export function reserveWithdrawal(userId, referenceId, now = Date.now()) {
  const key = typeof referenceId === 'string' ? referenceId.trim() : ''
  const duplicateKey = key ? `${userId}:${key}` : ''
  if (duplicateKey && idempotencyKeys.has(duplicateKey)) {
    return { allowed: false, reason: 'duplicate' }
  }

  const current = buckets.get(userId)
  const bucket = !current || now - current.windowStartedAt >= WINDOW_MS
    ? { windowStartedAt: now, count: 0 }
    : current
  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    buckets.set(userId, bucket)
    return { allowed: false, reason: 'rate' }
  }

  bucket.count += 1
  buckets.set(userId, bucket)
  if (duplicateKey) idempotencyKeys.set(duplicateKey, now)
  let released = false
  return {
    allowed: true,
    // The durable adapter records completion in Lekta. The process-local
    // development adapter has no separate reservation table; the accepted
    // request remains counted and its reference remains idempotent.
    commit() {},
    release() {
      if (released) return
      released = true
      releaseWithdrawalReservation(userId, referenceId)
    },
  }
}

export function releaseWithdrawalReservation(userId, referenceId) {
  const key = typeof referenceId === 'string' ? referenceId.trim() : ''
  if (key) idempotencyKeys.delete(`${userId}:${key}`)
  const bucket = buckets.get(userId)
  if (bucket) bucket.count = Math.max(0, bucket.count - 1)
}

export function resetWithdrawalLimiterForTests() {
  buckets.clear()
  idempotencyKeys.clear()
}
