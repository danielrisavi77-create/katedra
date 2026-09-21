export async function refundDuplicateProjectPass(stripe, { sessionId, paymentIntent }) {
  const paymentIntentId = typeof paymentIntent === 'string'
    ? paymentIntent
    : paymentIntent && typeof paymentIntent === 'object' && typeof paymentIntent.id === 'string'
      ? paymentIntent.id
      : ''

  if (!sessionId || !paymentIntentId) return { ok: false, reason: 'missing_payment_intent' }

  try {
    const refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey: `katedra-duplicate-pass-${sessionId}` },
    )
    if (!refund || typeof refund.id !== 'string' || !refund.id.trim()) {
      console.error(JSON.stringify({
        eventName: 'duplicate_project_pass_refund_invalid_response',
        sessionId,
        paymentIntentId,
      }))
      return { ok: false, reason: 'invalid_refund_response' }
    }
    return { ok: true, refundId: refund.id }
  } catch (error) {
    console.error(JSON.stringify({
      eventName: 'duplicate_project_pass_refund_failed',
      sessionId,
      paymentIntentId,
      error: error?.message,
    }))
    return { ok: false, reason: 'refund_failed' }
  }
}
