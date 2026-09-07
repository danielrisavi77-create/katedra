import { logOperationalEvent } from '../observability/operational-events'

export async function refundDuplicateProjectPass(stripe, { sessionId, paymentIntent }) {
  const paymentIntentId = typeof paymentIntent === 'string'
    ? paymentIntent
    : paymentIntent && typeof paymentIntent === 'object' && typeof paymentIntent.id === 'string'
      ? paymentIntent.id
      : ''

  if (!sessionId || !paymentIntentId) return { ok: false, reason: 'missing_payment_intent' }

  try {
    let refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey: `katedra-duplicate-pass-${sessionId}` },
    )
    if (!refund || typeof refund.id !== 'string' || !refund.id.trim()) {
      logOperationalEvent({
        eventName: 'duplicate_project_pass_refund_invalid_response',
        sessionId,
      }, 'error')
      return { ok: false, reason: 'invalid_refund_response' }
    }
    const refundId = refund.id
    // An idempotent create can replay its original pending response. Refresh
    // that same refund instead of changing the key or issuing a new refund.
    if (refund.status === 'pending' || refund.status === 'requires_action') {
      refund = await stripe.refunds.retrieve(refundId)
      if (!refund || refund.id !== refundId) return { ok: false, reason: 'invalid_refund_response' }
    }
    if (refund.status === 'succeeded') return { ok: true, refundId }
    if (refund.status === 'pending') return { ok: false, reason: 'refund_pending', refundId }
    if (refund.status === 'requires_action') return { ok: false, reason: 'refund_requires_action', refundId }
    if (refund.status === 'failed' || refund.status === 'canceled') return { ok: false, reason: 'refund_failed', refundId }
    return { ok: false, reason: 'invalid_refund_response', refundId }
  } catch (error) {
    logOperationalEvent({
      eventName: 'duplicate_project_pass_refund_failed',
      sessionId,
      error,
    }, 'error')
    return { ok: false, reason: 'refund_failed' }
  }
}
