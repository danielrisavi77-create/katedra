/**
 * Durable withdrawal reservation adapter.
 *
 * The database/RPC contract is owned by Lekta. The local limiter remains
 * useful for development, but must never be the production authority because
 * a multi-instance deployment would otherwise have one bucket per process.
 */

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
    console.error(JSON.stringify({
      eventName: 'withdrawal_reservation_failed',
      userId,
      referenceId,
      error: error?.message,
    }))
    return { allowed: false, reason: 'unavailable' }
  }

  if (result?.error) {
    console.error(JSON.stringify({
      eventName: 'withdrawal_reservation_failed',
      userId,
      referenceId,
      error: result.error.message,
    }))
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
      commitPromise = db.rpc('katedra_commit_withdrawal', {
        p_user: userId,
        p_reference_id: referenceId || null,
        p_request_id: requestId,
      }).then((commitResult) => {
        if (commitResult?.error) throw commitResult.error
        const decision = Array.isArray(commitResult?.data) ? commitResult.data[0] : commitResult?.data
        if (!['committed', 'already_committed'].includes(decision?.status)) {
          throw new Error('Unknown withdrawal commit status')
        }
      }).catch((error) => {
        console.error(JSON.stringify({
          eventName: 'withdrawal_reservation_commit_failed',
          userId,
          referenceId,
          error: error?.message,
        }))
        throw error
      })
      return commitPromise
    },
    release() {
      if (releasePromise) return releasePromise
      releasePromise = db.rpc('katedra_release_withdrawal', {
        p_user: userId,
        p_reference_id: referenceId || null,
      }).then((releaseResult) => {
        if (releaseResult?.error) throw releaseResult.error
      }).catch((error) => {
        console.error(JSON.stringify({
          eventName: 'withdrawal_reservation_release_failed',
          userId,
          referenceId,
          error: error?.message,
        }))
        throw error
      })
      return releasePromise
    },
  }
}
