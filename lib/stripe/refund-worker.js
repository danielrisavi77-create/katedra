import { refundDuplicateProjectPass } from './duplicate-refund'

export async function reconcilePendingRefunds(db, stripe, { now = Date.now, deadlineAt = now() + 30_000 } = {}) {
  const summary = { checked: 0, succeeded: 0, pending: 0, deferred: 0 }
  const result = await db.rpc('list_pending_katedra_pass_refunds', {})
  if (result.error || !Array.isArray(result.data) || result.data.length > 25) throw new Error('Refund queue unavailable')
  for (const [index, entry] of result.data.entries()) {
    if (now() >= deadlineAt) { summary.deferred = result.data.length - index; break }
    const outcome = await refundDuplicateProjectPass(stripe, {
      userId: entry.user_id, projectId: entry.project_id, sessionId: entry.session_id,
      paymentIntent: entry.payment_intent_id, amount: Number(entry.amount), currency: entry.currency,
    }, db)
    summary.checked++
    if (outcome.ok) summary.succeeded++
    else summary.pending++
  }
  return summary
}
