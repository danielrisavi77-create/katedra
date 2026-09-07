import { afterEach, describe, expect, it, vi } from 'vitest'

import { refundDuplicateProjectPass } from './duplicate-refund'

afterEach(() => vi.restoreAllMocks())

describe('refundDuplicateProjectPass', () => {
  it.each(['pending', 'requires_action', 'failed', 'canceled', undefined, 'unknown'])('never confirms a refund whose status is %s', async (status) => {
    const refunds = {
      create: vi.fn().mockResolvedValue({ id: 're_123', status }),
      retrieve: vi.fn().mockResolvedValue({ id: 're_123', status }),
    }
    const result = await refundDuplicateProjectPass({ refunds }, { sessionId: 'cs_duplicate', paymentIntent: 'pi_123' })
    expect(result.ok).toBe(false)
  })

  it('refreshes the cached pending refund without changing its idempotency key', async () => {
    const refunds = {
      create: vi.fn().mockResolvedValue({ id: 're_123', status: 'pending' }),
      retrieve: vi.fn()
        .mockResolvedValueOnce({ id: 're_123', status: 'pending' })
        .mockResolvedValueOnce({ id: 're_123', status: 'succeeded' }),
    }
    const input = { sessionId: 'cs_duplicate', paymentIntent: 'pi_123' }
    await expect(refundDuplicateProjectPass({ refunds }, input)).resolves.toMatchObject({ ok: false, reason: 'refund_pending', refundId: 're_123' })
    await expect(refundDuplicateProjectPass({ refunds }, input)).resolves.toEqual({ ok: true, refundId: 're_123' })
    expect(refunds.retrieve.mock.calls).toEqual([['re_123'], ['re_123']])
    expect(refunds.create.mock.calls).toEqual(Array(2).fill([
      { payment_intent: 'pi_123' }, { idempotencyKey: 'katedra-duplicate-pass-cs_duplicate' },
    ]))
  })

  it('does not log provider error text when refund refresh fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const refunds = {
      create: vi.fn().mockResolvedValue({ id: 're_123', status: 'pending' }),
      retrieve: vi.fn().mockRejectedValue(new Error('synthetic-private-provider-detail')),
    }
    await expect(refundDuplicateProjectPass({ refunds }, { sessionId: 'cs_duplicate', paymentIntent: 'pi_123' })).resolves.toMatchObject({ ok: false })
    expect(log).toHaveBeenCalled()
    expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private-provider-detail')
  })

  it('refunds once with an idempotency key for a duplicate session', async () => {
    const create = vi.fn().mockResolvedValue({ id: 're_123', status: 'succeeded' })
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

  it('fails closed when Stripe returns no refund identifier', async () => {
    const create = vi.fn().mockResolvedValue({})

    await expect(refundDuplicateProjectPass({ refunds: { create } }, {
      sessionId: 'cs_empty_refund',
      paymentIntent: 'pi_empty_refund',
    })).resolves.toMatchObject({ ok: false, reason: 'invalid_refund_response' })
  })
})
