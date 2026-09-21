import { afterEach, describe, expect, it } from 'vitest'

import { isDistributedRateLimitConfigured, reserveDistributedRequest, reserveUserRequest, resetRateLimiterForTests } from './rate-limit'

afterEach(() => resetRateLimiterForTests())

describe('reserveUserRequest', () => {
  it('rejects the ninth request in one minute for the same user', () => {
    const results = Array.from({ length: 9 }, () => {
      const result = reserveUserRequest('user-1', 1000)
      if (result.allowed) result.release()
      return result
    })

    expect(results.slice(0, 8).every((result) => result.allowed)).toBe(true)
    expect(results[8]).toMatchObject({ allowed: false, reason: 'rate' })
  })

  it('limits active streams and releases a reservation exactly once', () => {
    const first = reserveUserRequest('user-1', 1000)
    const second = reserveUserRequest('user-1', 1000)
    const third = reserveUserRequest('user-1', 1000)

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(true)
    expect(third).toMatchObject({ allowed: false, reason: 'concurrency' })

    first.release()
    first.release()
    expect(reserveUserRequest('user-1', 1000).allowed).toBe(true)
  })
})

describe('production rate-limit configuration', () => {
  it('does not claim the process-local map is production safe', () => {
    expect(isDistributedRateLimitConfigured({ NODE_ENV: 'production' })).toBe(false)
    expect(isDistributedRateLimitConfigured({ NODE_ENV: 'production', KATEDRA_RATE_LIMIT_STORE: 'supabase' })).toBe(true)
    expect(isDistributedRateLimitConfigured({ NODE_ENV: 'production', KATEDRA_RATE_LIMIT_STORE: 'redis' })).toBe(false)
  })

  it('uses an atomic reservation RPC and releases the same request exactly once', async () => {
    const calls = []
    const db = {
      async rpc(name, params) {
        calls.push([name, params])
        return { data: { status: name === 'katedra_reserve_request' ? 'reserved' : 'released' }, error: null }
      },
    }

    const reservation = await reserveDistributedRequest(db, { userId: 'user-1', requestId: 'request-1', estimatedCharge: 4_200 })
    expect(reservation).toMatchObject({ allowed: true })
    await reservation.release()
    await reservation.release()

    expect(calls).toEqual([
      ['katedra_reserve_request', { p_user: 'user-1', p_request_id: 'request-1', p_estimated_charge: 4_200 }],
      ['katedra_release_request', { p_user: 'user-1', p_request_id: 'request-1' }],
    ])
  })

  it('fails closed when the atomic reservation RPC is unavailable', async () => {
    const reservation = await reserveDistributedRequest({ rpc: async () => ({ data: null, error: { message: 'missing function' } }) }, { userId: 'user-1', requestId: 'request-1' })
    expect(reservation).toMatchObject({ allowed: false, reason: 'unavailable' })
  })

  it('turns a synchronous release RPC throw into a rejected promise', async () => {
    const db = {
      rpc(name) {
        if (name === 'katedra_reserve_request') return Promise.resolve({ data: { status: 'reserved' }, error: null })
        throw new Error('release connection failed')
      },
    }
    const reservation = await reserveDistributedRequest(db, { userId: 'user-1', requestId: 'request-1' })

    await expect(reservation.release()).rejects.toThrow('release connection failed')
  })

  it('rejects a release when the canonical RPC does not confirm released status', async () => {
    const db = {
      rpc(name) {
        if (name === 'katedra_reserve_request') return Promise.resolve({ data: { status: 'reserved' }, error: null })
        return Promise.resolve({ data: null, error: null })
      },
    }
    const reservation = await reserveDistributedRequest(db, { userId: 'user-1', requestId: 'request-1' })

    await expect(reservation.release()).rejects.toThrow('release confirmation')
  })

  it('allows a later release retry after a transient canonical RPC failure', async () => {
    let releaseAttempts = 0
    const db = {
      rpc(name) {
        if (name === 'katedra_reserve_request') return Promise.resolve({ data: { status: 'reserved' }, error: null })
        releaseAttempts += 1
        return releaseAttempts === 1
          ? Promise.reject(new Error('temporary release failure'))
          : Promise.resolve({ data: { status: 'released' }, error: null })
      },
    }
    const reservation = await reserveDistributedRequest(db, { userId: 'user-1', requestId: 'request-retry' })

    await expect(reservation.release()).rejects.toThrow('temporary release failure')
    await expect(reservation.release()).resolves.toBeUndefined()
    expect(releaseAttempts).toBe(2)
  })

  it('allows an idempotent agent retry after its previous reservation was released', async () => {
    const calls = []
    const db = {
      async rpc(name, params) {
        calls.push([name, params])
        return { data: { status: name === 'katedra_reserve_request' ? 'released' : 'released' }, error: null }
      },
    }

    const reservation = await reserveDistributedRequest(db, { userId: 'user-1', requestId: 'agent-retry-1' })

    expect(reservation).toMatchObject({ allowed: true })
    await reservation.release()
    expect(calls).toHaveLength(1)
  })
})
