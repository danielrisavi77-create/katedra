const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 8
const MAX_ACTIVE_STREAMS = 2
const reservations = new Map()

export function isDistributedRateLimitConfigured(runtime = process.env) {
  return runtime?.KATEDRA_RATE_LIMIT_STORE === 'supabase'
}

export async function reserveDistributedRequest(db, { userId, requestId, estimatedCharge = 0 }) {
  let result
  try {
    result = await db.rpc('katedra_reserve_request', {
      p_user: userId,
      p_request_id: requestId,
      p_estimated_charge: estimatedCharge,
    })
  } catch (error) {
    console.error(JSON.stringify({ eventName: 'rate_limit_reservation_failed', userId, requestId, error: error?.message }))
    return { allowed: false, reason: 'unavailable' }
  }

  if (result?.error) {
    console.error(JSON.stringify({ eventName: 'rate_limit_reservation_failed', userId, requestId, error: result.error.message }))
    return { allowed: false, reason: 'unavailable' }
  }

  const status = result?.data?.status
  if (status !== 'reserved') {
    return {
      allowed: false,
      reason: status === 'concurrency' ? 'concurrency' : status === 'rate' ? 'rate' : 'unavailable',
    }
  }

  let releasePromise = null
  return {
    allowed: true,
    release() {
      if (releasePromise) return releasePromise
      releasePromise = db.rpc('katedra_release_request', {
        p_user: userId,
        p_request_id: requestId,
      }).then((releaseResult) => {
        if (releaseResult?.error) throw releaseResult.error
      })
      return releasePromise
    },
  }
}

export function reserveUserRequest(userId, now = Date.now()) {
  const current = reservations.get(userId)
  const bucket = !current || now - current.windowStartedAt >= WINDOW_MS
    ? { windowStartedAt: now, count: 0, active: 0 }
    : current

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    reservations.set(userId, bucket)
    return { allowed: false, reason: 'rate' }
  }
  if (bucket.active >= MAX_ACTIVE_STREAMS) {
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

export function resetRateLimiterForTests() {
  reservations.clear()
}

export const RATE_LIMITS = {
  windowMs: WINDOW_MS,
  maxRequestsPerWindow: MAX_REQUESTS_PER_WINDOW,
  maxActiveStreams: MAX_ACTIVE_STREAMS,
}
