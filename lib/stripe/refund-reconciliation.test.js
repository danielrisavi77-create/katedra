import { describe, expect, it, vi } from 'vitest'
import { refundDuplicateProjectPass } from './duplicate-refund'

const input = { userId: 'user-1', projectId: 'project-1', sessionId: 'cs_duplicate', paymentIntent: 'pi_duplicate', amount: 1000, currency: 'eur' }
const refund = { id: 're_duplicate', payment_intent: 'pi_duplicate', amount: 1000, currency: 'eur', status: 'succeeded' }
function fixture(overrides = {}) {
  const entry = { session_id: input.sessionId, payment_intent_id: input.paymentIntent, amount: input.amount, currency: input.currency,
    lease_token: 'lease-1', refund_id: null, creation_attempted_at: null, status: 'requested', ...overrides }
  const rpc = vi.fn(async (name, params) => {
    if (name === 'claim_katedra_pass_refund') return { data: { ...entry }, error: null }
    if (name === 'mark_katedra_refund_attempt') entry.creation_attempted_at = new Date().toISOString()
    if (name === 'record_katedra_pass_refund') { entry.refund_id = params.p_refund_id; entry.status = params.p_status }
    return { data: null, error: null }
  })
  const refunds = { create: vi.fn().mockResolvedValue(refund), retrieve: vi.fn().mockResolvedValue(refund), list: vi.fn().mockResolvedValue({ data: [], has_more: false }) }
  return { entry, rpc, refunds, db: { rpc }, stripe: { refunds } }
}
describe('durable duplicate refund reconciliation', () => {
  it.each([
    { data: [refund], has_more: true },
    { data: [refund, { ...refund, id: 're_other' }], has_more: false },
  ])('stops at ambiguous history without pagination or creating a refund', async (history) => {
    const f = fixture()
    f.refunds.list.mockResolvedValue(history)
    expect(await refundDuplicateProjectPass(f.stripe, input, f.db)).toMatchObject({ ok: false, reason: 'refund_history_ambiguous' })
    expect(f.refunds.list).toHaveBeenCalledTimes(1)
    expect(f.refunds.create).not.toHaveBeenCalled()
  })
  it('records intent before creation and confirms only after durable success', async () => {
    const f = fixture()
    expect(await refundDuplicateProjectPass(f.stripe, input, f.db)).toEqual({ ok: true, refundId: refund.id })
    expect(f.rpc.mock.calls.map(call => call[0])).toEqual(['claim_katedra_pass_refund', 'mark_katedra_refund_attempt', 'record_katedra_pass_refund'])
    expect(f.rpc.mock.invocationCallOrder[1]).toBeLessThan(f.refunds.create.mock.invocationCallOrder[0])
    await refundDuplicateProjectPass(f.stripe, input, f.db)
    expect(f.refunds.create).toHaveBeenCalledTimes(1)
  })
  it('retrieves the persisted pending refund without creating another', async () => {
    const f = fixture({ refund_id: refund.id, status: 'pending' })
    expect(await refundDuplicateProjectPass(f.stripe, input, f.db)).toEqual({ ok: true, refundId: refund.id })
    expect(f.refunds.retrieve).toHaveBeenCalledWith(refund.id, { timeout: 10_000, maxNetworkRetries: 0 })
    expect(f.refunds.create).not.toHaveBeenCalled()
  })
  it('recovers an ambiguous create response from provider history', async () => {
    const f = fixture({ creation_attempted_at: '2026-01-01T00:00:00Z', status: 'needs_review' })
    f.refunds.list.mockResolvedValue({ data: [refund], has_more: false })
    expect(await refundDuplicateProjectPass(f.stripe, input, f.db)).toEqual({ ok: true, refundId: refund.id })
    expect(f.refunds.create).not.toHaveBeenCalled()
  })
  it('does not repeat an ambiguous creation outside the idempotency window', async () => {
    const f = fixture({ creation_attempted_at: '2026-01-01T00:00:00Z' })
    expect(await refundDuplicateProjectPass(f.stripe, input, f.db)).toMatchObject({ ok: false, reason: 'creation_window_expired' })
    expect(f.refunds.create).not.toHaveBeenCalled()
  })
  it('never calls Stripe when the canonical lease is unavailable', async () => {
    const f = fixture()
    f.rpc.mockResolvedValue({ data: null, error: null })
    expect(await refundDuplicateProjectPass(f.stripe, input, f.db)).toMatchObject({ ok: false })
    expect(f.refunds.create).not.toHaveBeenCalled()
    expect(f.refunds.list).not.toHaveBeenCalled()
  })
  it('does not acknowledge success if persistence fails', async () => {
    const f = fixture()
    const original = f.rpc.getMockImplementation()
    f.rpc.mockImplementation((name, params) => name === 'record_katedra_pass_refund' ? Promise.resolve({ error: {} }) : original(name, params))
    expect(await refundDuplicateProjectPass(f.stripe, input, f.db)).toMatchObject({ ok: false, reason: 'refund_ledger_unavailable' })
  })
  it('rejects a refund for another payment before recording success', async () => {
    const f = fixture({ refund_id: refund.id, status: 'pending' })
    f.refunds.retrieve.mockResolvedValue({ ...refund, payment_intent: 'pi_other' })
    expect(await refundDuplicateProjectPass(f.stripe, input, f.db)).toMatchObject({ ok: false })
    expect(f.rpc.mock.calls.some(([, params]) => params.p_status === 'succeeded')).toBe(false)
  })
})
