/**
 * Durable withdrawal reservation adapter.
 *
 * The database/RPC contract is owned by Lekta. The local limiter remains
 * useful for development, but must never be the production authority because
 * a multi-instance deployment would otherwise have one bucket per process.
 */

import { logOperationalEvent } from '../observability/operational-events'

export function isDistributedWithdrawalConfigured(runtime = process.env) {
  return runtime?.KATEDRA_RATE_LIMIT_STORE === 'supabase'
}

export async function reserveDistributedWithdrawal(db, { userId, referenceId = null }) {
  let result
  try {
    result = await db.rpc('katedra_reserve_withdrawal', {
      p_user: userId,
      p_reference_id: referenceId || null,
    })
  } catch (error) {
    logOperationalEvent({ eventName: 'withdrawal_reservation_failed', userId, reason: referenceId ? 'reference_present' : 'reference_absent', error }, 'error')
    return { allowed: false, reason: 'unavailable' }
  }

  if (result?.error) {
    logOperationalEvent({ eventName: 'withdrawal_reservation_failed', userId, reason: referenceId ? 'reference_present' : 'reference_absent', error: result.error }, 'error')
    return { allowed: false, reason: 'unavailable' }
  }

  const decision = Array.isArray(result?.data) ? result.data[0] : result?.data
  if (decision?.status !== 'reserved') {
    return {
      allowed: false,
      reason: decision?.status === 'duplicate'
        ? 'duplicate'
        : decision?.status === 'rate'
          ? 'rate'
          : 'unavailable',
    }
  }

  let releasePromise = null
  let commitPromise = null
  return {
    allowed: true,
    commit(requestId) {
      if (commitPromise) return commitPromise
      commitPromise = Promise.resolve().then(() => db.rpc('katedra_commit_withdrawal', {
        p_user: userId,
        p_reference_id: referenceId || null,
        p_request_id: requestId,
      })).then((commitResult) => {
        if (commitResult?.error) throw commitResult.error
        const decision = Array.isArray(commitResult?.data) ? commitResult.data[0] : commitResult?.data
        if (!['committed', 'already_committed'].includes(decision?.status)) {
          throw new Error('Unknown withdrawal commit status')
        }
      }).catch((error) => {
        logOperationalEvent({ eventName: 'withdrawal_reservation_commit_failed', userId, reason: referenceId ? 'reference_present' : 'reference_absent', error }, 'error')
        throw error
      })
      return commitPromise
    },
    release() {
      if (releasePromise) return releasePromise
      releasePromise = Promise.resolve().then(() => db.rpc('katedra_release_withdrawal', {
        p_user: userId,
        p_reference_id: referenceId || null,
      })).then((releaseResult) => {
        if (releaseResult?.error) throw releaseResult.error
        const decision = Array.isArray(releaseResult?.data) ? releaseResult.data[0] : releaseResult?.data
        if (decision?.status !== 'released') throw new Error('Missing withdrawal release confirmation from canonical RPC.')
      }).catch((error) => {
        releasePromise = null
        logOperationalEvent({ eventName: 'withdrawal_reservation_release_failed', userId, reason: referenceId ? 'reference_present' : 'reference_absent', error }, 'error')
        throw error
      })
      return releasePromise
    },
  }
}
