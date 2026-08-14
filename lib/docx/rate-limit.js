const WINDOW_MS = 60_000
const MAX_UPLOADS_PER_WINDOW = 3
const reservations = new Map()

export function reserveDocxUpload(userId, now = Date.now()) {
  const current = reservations.get(userId)
  const bucket = !current || now - current.windowStartedAt >= WINDOW_MS
    ? { windowStartedAt: now, count: 0, active: 0 }
    : current

  if (bucket.count >= MAX_UPLOADS_PER_WINDOW) {
    reservations.set(userId, bucket)
    return { allowed: false, reason: 'rate' }
  }
  if (bucket.active >= 1) {
    reservations.set(userId, bucket)
    return { allowed: false, reason: 'concurrency' }
  }

  bucket.count += 1
  bucket.active += 1
  reservations.set(userId, bucket)
  let released = false
  return {
    allowed: true,
    release() {
      if (released) return
      released = true
      bucket.active = Math.max(0, bucket.active - 1)
    },
  }
}

export function resetDocxRateLimiterForTests() {
  reservations.clear()
}
