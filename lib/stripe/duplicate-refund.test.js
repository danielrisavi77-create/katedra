import { describe, expect, it, vi } from 'vitest'

import { refundDuplicateProjectPass } from './duplicate-refund'

describe('refundDuplicateProjectPass', () => {
  it('refunds once with an idempotency key for a duplicate session', async () => {
    const create = vi.fn().mockResolvedValue({ id: 're_123' })
    const result = await refundDuplicateProjectPass({ refunds: { create } }, {
      sessionId: 'cs_duplicate',
      paymentIntent: 'pi_123',
    })

    expect(result).toEqual({ ok: true, refundId: 're_123' })
    expect(create).toHaveBeenCalledWith(
      { payment_intent: 'pi_123' },
      { idempotencyKey: 'katedra-duplicate-pass-cs_duplicate' },
    )
  })

  it('fails closed when the payment intent is missing or Stripe rejects the refund', async () => {
    const create = vi.fn().mockRejectedValue(new Error('Stripe unavailable'))
    await expect(refundDuplicateProjectPass({ refunds: { create } }, {
      sessionId: 'cs_missing_intent',
      paymentIntent: null,
    })).resolves.toMatchObject({ ok: false, reason: 'missing_payment_intent' })
    expect(create).not.toHaveBeenCalled()

    await expect(refundDuplicateProjectPass({ refunds: { create } }, {
      sessionId: 'cs_failed_refund',
      paymentIntent: 'pi_failed',
    })).resolves.toMatchObject({ ok: false, reason: 'refund_failed' })
  })
})
