import { afterEach, describe, expect, it, vi } from 'vitest'
import { refundDuplicateProjectPass } from './duplicate-refund'

afterEach(() => vi.restoreAllMocks())
const input = { sessionId: 'cs_duplicate', paymentIntent: 'pi_123', userId: 'user-1', projectId: 'project-1', amount: 1000, currency: 'eur' }
function fixture(status) {
  const entry = { session_id: input.sessionId, payment_intent_id: input.paymentIntent, amount: 1000, currency: 'eur', lease_token: 'lease', status: 'requested', refund_id: null }
  const rpc = vi.fn(async (name, params) => {
    if (name === 'claim_katedra_pass_refund') return { data: { ...entry }, error: null }
    if (name === 'record_katedra_pass_refund') { entry.status=params.p_status; entry.refund_id=params.p_refund_id }
    return { data: null, error: null }
  })
  const evidence = { id: 're_123', status, payment_intent: 'pi_123', amount: 1000, currency: 'eur' }
  const refunds = { create: vi.fn().mockResolvedValue(evidence), retrieve: vi.fn().mockResolvedValue(evidence), list: vi.fn().mockResolvedValue({ data: [], has_more: false }) }
  return { db: { rpc }, stripe: { refunds }, refunds, evidence }
}
describe('refundDuplicateProjectPass', () => {
  it.each(['pending', 'requires_action', 'failed', 'canceled', undefined, 'unknown'])('never confirms a refund whose status is %s', async status => {
    const f=fixture(status)
    expect((await refundDuplicateProjectPass(f.stripe,input,f.db)).ok).toBe(false)
  })
  it('refreshes the persisted pending refund without repeating creation', async () => {
    const f=fixture('pending')
    expect(await refundDuplicateProjectPass(f.stripe,input,f.db)).toMatchObject({ ok:false, reason:'refund_pending', refundId:'re_123' })
    f.refunds.retrieve.mockResolvedValue({ ...f.evidence,status:'succeeded' })
    expect(await refundDuplicateProjectPass(f.stripe,input,f.db)).toEqual({ ok:true,refundId:'re_123' })
    expect(f.refunds.create).toHaveBeenCalledTimes(1)
    expect(f.refunds.retrieve).toHaveBeenCalledWith('re_123',expect.objectContaining({ timeout:10000 }))
  })
  it('does not log or persist provider error text', async () => {
    const log=vi.spyOn(console,'error').mockImplementation(()=>{})
    const f=fixture('pending')
    f.refunds.list.mockRejectedValue(new Error('synthetic-private-provider-detail'))
    expect(await refundDuplicateProjectPass(f.stripe,input,f.db)).toMatchObject({ ok:false })
    expect(JSON.stringify([log.mock.calls,f.db.rpc.mock.calls])).not.toContain('synthetic-private-provider-detail')
  })
  it('keeps the legacy creation key and parameters', async () => {
    const f=fixture('succeeded')
    expect(await refundDuplicateProjectPass(f.stripe,input,f.db)).toEqual({ ok:true,refundId:'re_123' })
    expect(f.refunds.create).toHaveBeenCalledWith({ payment_intent:'pi_123' },expect.objectContaining({ idempotencyKey:'katedra-duplicate-pass-cs_duplicate' }))
  })
  it('fails closed when the payment intent or canonical ledger is missing', async () => {
    const f=fixture('succeeded')
    expect(await refundDuplicateProjectPass(f.stripe,{ ...input,paymentIntent:null },f.db)).toMatchObject({ ok:false,reason:'missing_payment_intent' })
    expect(await refundDuplicateProjectPass(f.stripe,input)).toMatchObject({ ok:false,reason:'refund_ledger_unavailable' })
    expect(f.refunds.create).not.toHaveBeenCalled()
  })
  it('fails closed when Stripe returns no refund identifier', async () => {
    const f=fixture('succeeded')
    f.refunds.create.mockResolvedValue({})
    expect(await refundDuplicateProjectPass(f.stripe,input,f.db)).toMatchObject({ ok:false })
  })
})
