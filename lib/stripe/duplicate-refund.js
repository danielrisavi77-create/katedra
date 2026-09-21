const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000
const REFUND_STATES = new Set(['pending', 'requires_action', 'succeeded', 'failed', 'canceled'])
const REQUEST_OPTIONS = { timeout: 10_000, maxNetworkRetries: 0 }
const providerId = (value) => typeof value === 'string' ? value : value?.id

export async function refundDuplicateProjectPass(stripe, input, db) {
  const paymentIntentId = providerId(input.paymentIntent)
  if (!input.sessionId || !paymentIntentId) return { ok: false, reason: 'missing_payment_intent' }
  if (!db?.rpc || !input.userId || !input.projectId || !Number.isSafeInteger(input.amount) || input.amount <= 0
    || !/^[a-z]{3}$/.test(input.currency || '')) return { ok: false, reason: 'refund_ledger_unavailable' }
  let entry
  try {
    const claimed = await db.rpc('claim_katedra_pass_refund', {
      p_user_id: input.userId, p_project_id: input.projectId, p_session_id: input.sessionId,
      p_payment_intent_id: paymentIntentId, p_amount: input.amount, p_currency: input.currency,
    })
    if (claimed.error) return { ok: false, reason: 'refund_ledger_unavailable' }
    entry = claimed.data
    if (!entry) return { ok: false, reason: 'refund_in_progress' }
    if (entry.session_id !== input.sessionId || entry.payment_intent_id !== paymentIntentId
      || Number(entry.amount) !== input.amount || entry.currency !== input.currency) return { ok: false, reason: 'refund_identity_conflict' }
    if (entry.status === 'succeeded' && /^re_[A-Za-z0-9_]+$/.test(entry.refund_id || '')) return { ok: true, refundId: entry.refund_id }
    if (!entry.lease_token) return { ok: false, reason: 'refund_ledger_unavailable' }
  } catch { return { ok: false, reason: 'refund_ledger_unavailable' } }

  async function persist(status, refundId, errorCode = null) {
    try {
      const result = await db.rpc('record_katedra_pass_refund', {
        p_session_id: input.sessionId, p_lease_token: entry.lease_token,
        p_refund_id: refundId || null, p_status: status, p_error_code: errorCode,
      })
      return !result.error
    } catch { return false }
  }
  async function unresolved(reason) {
    const recorded = await persist('needs_review', entry.refund_id, reason)
    return { ok: false, reason: recorded ? reason : 'refund_ledger_unavailable' }
  }
  try {
    let refund
    if (entry.refund_id) {
      refund = await stripe.refunds.retrieve(entry.refund_id, REQUEST_OPTIONS)
    } else {
      // Recover creates whose response was lost, including refunds predating this ledger.
      const listed = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 }, REQUEST_OPTIONS)
      if (!Array.isArray(listed?.data) || typeof listed.has_more !== 'boolean') return unresolved('invalid_provider_response')
      // More than one refund is already ambiguous; pagination cannot make it safe.
      if (listed.has_more || listed.data.length > 1) return unresolved('refund_history_ambiguous')
      refund = listed.data[0]
      if (!refund) {
        const attemptedAt = entry.creation_attempted_at ? Date.parse(entry.creation_attempted_at) : null
        if (attemptedAt !== null && (!Number.isFinite(attemptedAt) || Date.now() - attemptedAt >= RETRY_WINDOW_MS)) {
          return unresolved('creation_window_expired')
        }
        const marked = await db.rpc('mark_katedra_refund_attempt', { p_session_id: input.sessionId, p_lease_token: entry.lease_token })
        if (marked.error) return { ok: false, reason: 'refund_ledger_unavailable' }
        // Preserve the existing key AND parameters for retries crossing the rollout.
        refund = await stripe.refunds.create({ payment_intent: paymentIntentId }, { ...REQUEST_OPTIONS, idempotencyKey: `katedra-duplicate-pass-${input.sessionId}` })
      }
    }
    if (!refund || typeof refund.id !== 'string' || !/^re_[A-Za-z0-9_]+$/.test(refund.id)
      || (entry.refund_id && refund.id !== entry.refund_id)
      || providerId(refund.payment_intent) !== paymentIntentId || refund.amount !== input.amount || refund.currency !== input.currency) {
      return unresolved('refund_identity_conflict')
    }
    if (!REFUND_STATES.has(refund.status)) return unresolved('invalid_provider_response')
    if (!await persist(refund.status, refund.id)) return { ok: false, reason: 'refund_ledger_unavailable' }
    if (refund.status === 'succeeded') return { ok: true, refundId: refund.id }
    return { ok: false, reason: refund.status === 'pending' ? 'refund_pending' : refund.status === 'requires_action' ? 'refund_requires_action' : 'refund_failed', refundId: refund.id }
  } catch {
    // No provider text, object paths or secrets are written into reconciliation state.
    return unresolved('provider_unavailable')
  }
}
