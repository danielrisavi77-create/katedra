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
    return { ok: true, refundId: refund?.id || null }
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
