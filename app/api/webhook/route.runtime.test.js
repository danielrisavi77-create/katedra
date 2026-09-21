import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  getStripe: vi.fn(),
  createAdminClient: vi.fn(),
  getKatedraPackage: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({ getStripe: mocks.getStripe }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/stripe/catalog', () => ({
  getKatedraPackage: mocks.getKatedraPackage,
  PURCHASE_WINDOW_DAYS: { diplomski: 365 },
}))

import { POST } from './route'

const projectId = '11111111-1111-4111-8111-111111111111'
function refundLedgerRpc() {
  return vi.fn(async (name) => {
    if (name === 'read_katedra_pass_refund') return { data: null, error: null }
    if (name === 'claim_katedra_pass_refund') return { data: {
      session_id: 'cs_second', payment_intent_id: 'pi_second', amount: 12990, currency: 'eur',
      lease_token: 'lease-1', refund_id: null, status: 'requested', creation_attempted_at: null,
    }, error: null }
    if (['mark_katedra_refund_attempt', 'record_katedra_pass_refund'].includes(name)) return { data: null, error: null }
    throw new Error('Duplicate payment must not grant a wallet or entitlement')
  })
}
const refundEvidence = (id, status) => ({ id, status, amount: 12990, currency: 'eur', payment_intent: 'pi_second' })

function request() {
  return new Request('http://localhost/api/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'test-signature' },
    body: '{}',
  })
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('POST /api/webhook runtime guards', () => {
  it.each([true, false])('does not grant a refunded purchase after original Pass expiry (ledger=%s)', async (recorded) => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    mocks.getKatedraPackage.mockReturnValue({ productId: 'katedra_pass_diplomski', tokens: 12_000_000, eur: 129.9, workType: 'graduate' })
    const baseRpc = refundLedgerRpc().getMockImplementation()
    const rpc = vi.fn((name, params) => name === 'read_katedra_pass_refund'
      ? Promise.resolve({ data: recorded ? { session_id: 'cs_second', status: 'pending' } : null, error: null }) : baseRpc(name, params))
    const from = vi.fn(table => {
      const query = { select: () => query, eq: () => query, or: () => query, gt: () => query, limit: () => query,
        maybeSingle: async () => ({ data: table === 'katedra_projects' ? { user_id: 'user-1', project_id: projectId, work_type_canonical: 'graduate' } : null, error: null }),
        insert: () => { throw new Error('Refunded purchase must not grant entitlement') } }
      return query
    })
    mocks.createAdminClient.mockReturnValue({ rpc, from })
    mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: () => ({ type: 'checkout.session.completed', data: { object: {
      id: 'cs_second', mode: 'payment', payment_status: 'paid', currency: 'eur', amount_total: 12990, payment_intent: 'pi_second',
      metadata: { user_id: 'user-1', academic_project_id: projectId, product_key: 'diplomski', product_id: 'katedra_pass_diplomski', tokens: '12000000', amount_eur: '129.9' },
    } } }) }, refunds: { list: vi.fn().mockResolvedValue({ data: [refundEvidence('re_recovered', 'succeeded')], has_more: false }) } })
    expect((await POST(request())).status).toBe(200)
    expect(from.mock.calls).toEqual([['katedra_projects']])
    expect(rpc.mock.calls.some(([name]) => name === 'katedra_grant')).toBe(false)
  })
  it.each([
    ['exact replay', {}, 200],
    ['missing purchase', null, 500],
    ['foreign owner', { user_id: 'other-user' }, 500],
    ['foreign project', { academic_project_id: '22222222-2222-4222-8222-222222222222' }, 500],
    ['wrong product', { product_id: 'katedra_pass_seminarski' }, 500],
    ['wrong work type', { work_type: 'seminarski' }, 500],
    ['wrong provider', { provider: 'other' }, 500],
    ['wrong order', { order_id: 'cs_other' }, 500],
    ['lookup error', { lookupError: true }, 500],
    ['lookup rejects', { lookupThrows: true }, 500],
  ])('proves purchase identity after a unique conflict: %s', async (_name, override, expectedStatus) => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    mocks.getKatedraPackage.mockReturnValue({ productId: 'katedra_pass_diplomski', tokens: 12_000_000, eur: 129.9, workType: 'graduate' })
    mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: () => ({
      type: 'checkout.session.completed', data: { object: {
        id: 'cs_replay', payment_intent: 'pi_replay', mode: 'payment', payment_status: 'paid', currency: 'eur', amount_total: 12_990,
        metadata: { user_id: 'user-1', academic_project_id: projectId, product_key: 'diplomski', product_id: 'katedra_pass_diplomski', tokens: '12000000', amount_eur: '129.9' },
      } },
    }) }, refunds: { list: vi.fn().mockResolvedValue({ data: [], has_more: false }) } })
    let inserted = false
    const replayFilters = []
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const db = {
      rpc,
      from(table) {
        const query = {
          select() { return query },
          eq(column, value) { if (inserted) replayFilters.push([column, value]); return query },
          or() { return query }, gt() { if (inserted) throw new Error('Replay identity must not filter expiry'); return query }, limit() { return query },
          async insert() { inserted = true; return { error: { code: '23505' } } },
          async maybeSingle() {
            if (table === 'katedra_projects') return { data: { user_id: 'user-1', project_id: projectId, work_type_canonical: 'graduate' }, error: null }
            if (!inserted) return { data: null, error: null }
            if (override?.lookupThrows) throw new Error('private-database-detail')
            return {
              data: override === null ? null : { id: 'entitlement-1', user_id: 'user-1', academic_project_id: projectId, provider: 'stripe', order_id: 'cs_replay', product_id: 'katedra_pass_diplomski', work_type: 'diplomski', ...override },
              error: override?.lookupError ? { code: 'XX000', message: 'private-database-detail' } : null,
            }
          },
        }
        return query
      },
    }
    mocks.createAdminClient.mockReturnValue(db)
    const response = await POST(request())
    expect(response.status).toBe(expectedStatus)
    expect(await response.text()).not.toContain('private-database-detail')
    if (expectedStatus === 200) {
      expect(rpc).toHaveBeenCalledWith('katedra_grant', expect.objectContaining({ p_user: 'user-1', p_session: 'cs_replay' }))
      expect(replayFilters).toEqual([['provider', 'stripe'], ['order_id', 'cs_replay']])
    } else expect(rpc.mock.calls.every(([name]) => name === 'read_katedra_pass_refund')).toBe(true)
  })

  it('returns a retryable response when the admin client is unavailable', async () => {
    mocks.getKatedraPackage.mockReturnValue({ productId: 'katedra_pass_diplomski', tokens: 12_000_000, eur: 129.9, workType: 'graduate' })
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: {
          id: 'cs_admin_client_unavailable',
          mode: 'payment',
          payment_status: 'paid',
          currency: 'eur',
          amount_total: 12_990,
          metadata: {
            user_id: 'user-1',
            academic_project_id: projectId,
            product_key: 'diplomski',
            product_id: 'katedra_pass_diplomski',
            topic: 'Tema',
            lock_confirmation: 'true',
            tokens: '12000000',
            amount_eur: '129.9',
          },
        } },
      }) },
    })
    mocks.createAdminClient.mockImplementation(() => { throw new Error('missing service role') })

    const response = await POST(request())

    expect(response.status).toBe(503)
    await expect(response.text()).resolves.toBe('billing storage unavailable')
  })

  it('rejects a paid event whose product metadata disagrees with the server catalog', async () => {
    mocks.getKatedraPackage.mockReturnValue({ productId: 'katedra_pass_diplomski', tokens: 12_000_000, eur: 129.9, workType: 'graduate' })
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: {
          id: 'cs_wrong_product_metadata',
          mode: 'payment',
          payment_status: 'paid',
          currency: 'eur',
          amount_total: 12_990,
          metadata: {
            user_id: 'user-1',
            academic_project_id: projectId,
            product_key: 'diplomski',
            product_id: 'katedra_pass_seminarski',
            topic: 'Digitalizacija javne uprave',
            lock_confirmation: 'true',
            tokens: '12000000',
            amount_eur: '129.9',
          },
        } },
      }) },
    })

    const response = await POST(request())

    expect(response.status).toBe(400)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('rejects a paid event whose project work type disagrees with the purchased Pass', async () => {
    mocks.getKatedraPackage.mockReturnValue({ productId: 'katedra_pass_diplomski', tokens: 12_000_000, eur: 129.9, workType: 'graduate' })
    const db = {
      from() {
        const query = {
          select() { return query },
          eq() { return query },
          async maybeSingle() {
            return { data: { user_id: 'user-1', project_id: projectId, work_type_canonical: 'seminar', topic: 'Tema' }, error: null }
          },
        }
        return query
      },
    }
    mocks.createAdminClient.mockReturnValue(db)
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: {
          id: 'cs_wrong_project_product',
          mode: 'payment',
          payment_status: 'paid',
          currency: 'eur',
          amount_total: 12_990,
          metadata: {
            user_id: 'user-1',
            academic_project_id: projectId,
            product_key: 'diplomski',
            product_id: 'katedra_pass_diplomski',
            topic: 'Tema',
            lock_confirmation: 'true',
            tokens: '12000000',
            amount_eur: '129.9',
          },
        } },
      }) },
    })

    const response = await POST(request())

    expect(response.status).toBe(400)
  })

  it('fails closed before granting a paid session when production project locks are disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_prod_without_lock', mode: 'payment' } },
      }) },
    })

    const response = await POST(request())

    expect(response.status).toBe(503)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('fails closed before granting a paid session when production billing contract is not v2', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'legacy')
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_prod_without_billing_contract', mode: 'payment' } },
      }) },
    })

    const response = await POST(request())

    expect(response.status).toBe(503)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it.each(['succeeded', 'pending', 'failed'])('does not grant a second active Pass when duplicate refund is %s', async (refundStatus) => {
    mocks.getStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockReturnValue({
          type: 'checkout.session.completed',
          data: { object: {
            id: 'cs_second',
            mode: 'payment',
            payment_status: 'paid',
            payment_intent: 'pi_second',
            currency: 'eur',
            amount_total: 12_990,
            metadata: {
              user_id: 'user-1',
              academic_project_id: projectId,
              product_key: 'diplomski',
              product_id: 'katedra_pass_diplomski',
              topic: 'Digitalizacija javne uprave',
              lock_confirmation: 'true',
              tokens: '12000000',
              amount_eur: '129.9',
            },
          } },
        }),
      },
    })
    mocks.getKatedraPackage.mockReturnValue({ productId: 'katedra_pass_diplomski', tokens: 12_000_000, eur: 129.9, workType: 'graduate' })
    const refundCreate = vi.fn().mockResolvedValue(refundEvidence('re_second', refundStatus))
    const calls = []
    const db = {
      from(table) {
        calls.push(['from', table])
        const query = {
          select() { return query },
          eq() { return query },
          is() { return query },
          or() { return query },
          gt() { return query },
          limit() { return query },
          async maybeSingle() {
            if (table === 'katedra_projects') return { data: { user_id: 'user-1', project_id: projectId, work_type_canonical: 'graduate' }, error: null }
            return { data: { id: 'entitlement-1', order_id: 'cs_first' }, error: null }
          },
          insert() {
            throw new Error('duplicate session must not insert')
          },
        }
        return query
      },
      rpc: refundLedgerRpc(),
    }
    mocks.createAdminClient.mockReturnValue(db)
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: {
          id: 'cs_second',
          mode: 'payment',
          payment_status: 'paid',
          payment_intent: 'pi_second',
          currency: 'eur',
          amount_total: 12_990,
          metadata: {
            user_id: 'user-1',
            academic_project_id: projectId,
            product_key: 'diplomski',
            product_id: 'katedra_pass_diplomski',
            topic: 'Digitalizacija javne uprave',
            lock_confirmation: 'true',
            tokens: '12000000',
            amount_eur: '129.9',
          },
        } },
      }) },
      refunds: { create: refundCreate, list: vi.fn().mockResolvedValue({ data: [], has_more: false }) },
    })

    const response = await POST(request())

    expect(response.status).toBe(refundStatus === 'succeeded' ? 200 : 500)
    expect(await response.text()).toBe(refundStatus === 'succeeded' ? 'ok' : 'duplicate refund pending')
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(['read_katedra_pass_refund', 'claim_katedra_pass_refund', 'mark_katedra_refund_attempt', 'record_katedra_pass_refund'])
    expect(refundCreate).toHaveBeenCalledWith(
      { payment_intent: 'pi_second' },
      { idempotencyKey: 'katedra-duplicate-pass-cs_second', timeout: 10_000, maxNetworkRetries: 0 },
    )
    expect(calls).toEqual([
      ['from', 'katedra_projects'],
      ['from', 'entitlements'],
    ])
  })

  it('locks the paid project before granting the first entitlement for an async payment', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: 'checkout.session.async_payment_succeeded',
        data: { object: {
          id: 'cs_first',
          mode: 'payment',
          payment_status: 'paid',
          payment_intent: 'pi_first',
          currency: 'eur',
          amount_total: 12_990,
          metadata: {
            user_id: 'user-1',
            academic_project_id: projectId,
            product_key: 'diplomski',
            product_id: 'katedra_pass_diplomski',
            topic: 'Digitalizacija javne uprave',
            lock_confirmation: 'true',
            tokens: '12000000',
            amount_eur: '129.9',
          },
        } },
      }) },
      refunds: { list: vi.fn().mockResolvedValue({ data: [], has_more: false }) },
    })
    mocks.getKatedraPackage.mockReturnValue({ productId: 'katedra_pass_diplomski', tokens: 12_000_000, eur: 129.9, workType: 'graduate' })
    const calls = []
    const db = {
      rpc(name, params) {
        calls.push(['rpc', name, params])
        if (name === 'lock_paid_project') return Promise.resolve({ data: {
          lock_id: 'lock-1', user_id: 'user-1', project_id: projectId, topic: 'Digitalizacija javne uprave', work_type: 'diplomski', product_key: 'diplomski', payment_id: 'cs_first', locked_at: '2026-08-14T10:00:00.000Z', status: 'locked',
        }, error: null })
        return Promise.resolve({ data: null, error: null })
      },
      from(table) {
        calls.push(['from', table])
        const query = {
          select() { return query },
          eq() { return query },
          or() { return query },
          gt() { return query },
          limit() { return query },
          insert(value) {
            calls.push(['insert', table, value])
            return Promise.resolve({ error: null })
          },
          async maybeSingle() {
            if (table === 'katedra_projects') return { data: { user_id: 'user-1', project_id: projectId, work_type_canonical: 'graduate', topic: 'Digitalizacija javne uprave' }, error: null }
            if (table === 'entitlements') return { data: null, error: null }
            return { data: null, error: null }
          },
        }
        return query
      },
    }
    mocks.createAdminClient.mockReturnValue(db)

    const response = await POST(request())

    expect(response.status).toBe(200)
    const lockInsert = calls.findIndex((call) => call[0] === 'rpc' && call[1] === 'lock_paid_project')
    const entitlementInsert = calls.findIndex((call) => call[0] === 'insert' && call[1] === 'entitlements')
    expect(lockInsert).toBeGreaterThan(-1)
    expect(entitlementInsert).toBeGreaterThan(lockInsert)
    expect(calls[entitlementInsert][2]).toMatchObject({
      product_id: 'katedra_pass_diplomski',
      academic_project_id: projectId,
    })
  })

  it('refunds a second payment when the canonical project lock already belongs to another session', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    mocks.getKatedraPackage.mockReturnValue({ productId: 'katedra_pass_diplomski', tokens: 12_000_000, eur: 129.9, workType: 'graduate' })
    const refundCreate = vi.fn().mockResolvedValue(refundEvidence('re_second_lock_race', 'succeeded'))
    const calls = []
    const db = {
      rpc: refundLedgerRpc(),
      from(table) {
        calls.push(['from', table])
        const query = {
          select() { return query },
          eq() { return query },
          or() { return query },
          gt() { return query },
          limit() { return query },
          async maybeSingle() {
            if (table === 'katedra_projects') return { data: { user_id: 'user-1', project_id: projectId, work_type_canonical: 'graduate', topic: 'Digitalizacija javne uprave' }, error: null }
            if (table === 'entitlements') return { data: null, error: null }
            if (table === 'katedra_project_locks') return { data: {
              lock_id: 'lock-first', user_id: 'user-1', project_id: projectId,
              topic: 'Digitalizacija javne uprave', work_type: 'diplomski',
              product_key: 'diplomski', payment_id: 'cs_first',
              locked_at: '2026-08-14T10:00:00.000Z', status: 'locked',
            }, error: null }
            return { data: null, error: null }
          },
          insert() {
            throw new Error('duplicate lock race must not insert entitlement')
          },
        }
        return query
      },
    }
    mocks.createAdminClient.mockReturnValue(db)
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEvent: vi.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: {
          id: 'cs_second', mode: 'payment', payment_status: 'paid',
          payment_intent: 'pi_second', currency: 'eur', amount_total: 12_990,
          metadata: {
            user_id: 'user-1', academic_project_id: projectId,
            product_key: 'diplomski', product_id: 'katedra_pass_diplomski', topic: 'Digitalizacija javne uprave',
            lock_confirmation: 'true', tokens: '12000000', amount_eur: '129.9',
          },
        } },
      }) },
      refunds: { create: refundCreate, list: vi.fn().mockResolvedValue({ data: [], has_more: false }) },
    })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
    expect(refundCreate).toHaveBeenCalledWith(
      { payment_intent: 'pi_second' },
      { idempotencyKey: 'katedra-duplicate-pass-cs_second', timeout: 10_000, maxNetworkRetries: 0 },
    )
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(['read_katedra_pass_refund', 'claim_katedra_pass_refund', 'mark_katedra_refund_attempt', 'record_katedra_pass_refund'])
    expect(calls).toEqual([
      ['from', 'katedra_projects'],
      ['from', 'entitlements'],
      ['from', 'katedra_project_locks'],
    ])
  })
})
