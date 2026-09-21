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

  it('does not grant a second active Pass for a concurrent paid session', async () => {
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
    const refundCreate = vi.fn().mockResolvedValue({ id: 're_second' })
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
      rpc: vi.fn(() => { throw new Error('duplicate session must not grant wallet') }),
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
      refunds: { create: refundCreate },
    })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
    expect(db.rpc).not.toHaveBeenCalled()
    expect(refundCreate).toHaveBeenCalledWith(
      { payment_intent: 'pi_second' },
      { idempotencyKey: 'katedra-duplicate-pass-cs_second' },
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
    const refundCreate = vi.fn().mockResolvedValue({ id: 're_second_lock_race' })
    const calls = []
    const db = {
      rpc: vi.fn(() => { throw new Error('a duplicate lock race must not grant wallet') }),
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
      refunds: { create: refundCreate },
    })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
    expect(refundCreate).toHaveBeenCalledWith(
      { payment_intent: 'pi_second' },
      { idempotencyKey: 'katedra-duplicate-pass-cs_second' },
    )
    expect(db.rpc).not.toHaveBeenCalled()
    expect(calls).toEqual([
      ['from', 'katedra_projects'],
      ['from', 'entitlements'],
      ['from', 'katedra_project_locks'],
    ])
  })
})
