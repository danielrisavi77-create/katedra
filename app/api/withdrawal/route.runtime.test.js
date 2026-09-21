import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  isDistributedWithdrawalConfigured: vi.fn(),
  reserveDistributedWithdrawal: vi.fn(),
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/security/withdrawal-reservation', () => ({
  isDistributedWithdrawalConfigured: mocks.isDistributedWithdrawalConfigured,
  reserveDistributedWithdrawal: mocks.reserveDistributedWithdrawal,
}))
vi.mock('@/lib/security/withdrawal-limit', () => ({ reserveWithdrawal: vi.fn() }))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.sendEmail } } }))

import { POST } from './route'

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('RESEND_API_KEY', 'resend-test')
  vi.stubEnv('WITHDRAWAL_FROM_EMAIL', 'support@example.test')
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.test' } } }) },
  })
  mocks.createAdminClient.mockReturnValue({
    from() {
      const query = {
        insert() { return query },
        select() { return query },
        async single() { return { data: null, error: { code: 'PGRST205', message: 'table missing' } } },
      }
      return query
    },
  })
  mocks.isDistributedWithdrawalConfigured.mockReturnValue(true)
  mocks.reserveDistributedWithdrawal.mockResolvedValue({
    allowed: true,
    release: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
  })
})

describe('POST /api/withdrawal runtime guards', () => {
  function durableRequest(updateResult = { error: null }) {
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(updateResult) })
    mocks.createAdminClient.mockReturnValue({
      from: () => ({
        insert: () => ({ select: () => ({ single: async () => ({
          data: { id: 'withdrawal-1', requested_at: '2026-09-07T12:00:00.000Z' }, error: null,
        }) }) }),
        update,
      }),
    })
    return update
  }

  function receiptRequest() {
    return new Request('http://localhost/api/withdrawal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ referenceId: 'withdrawal-1' }),
    })
  }

  it.each([
    { data: null, error: { name: 'validation_error', message: 'email rejected' } },
    { data: null, error: null },
  ])('preserves the receipt without confirming an unaccepted email (%j)', async (result) => {
    const update = durableRequest()
    mocks.sendEmail.mockResolvedValue(result)

    const response = await POST(receiptRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true, requestId: 'withdrawal-1', emailSent: false, reconciliationPending: true,
    })
    expect(update).not.toHaveBeenCalled()
    const reservation = await mocks.reserveDistributedWithdrawal.mock.results[0].value
    expect(reservation.commit).toHaveBeenCalledWith('withdrawal-1')
    expect(reservation.release).not.toHaveBeenCalled()
  })

  it('reports reconciliation when accepted email confirmation cannot be persisted', async () => {
    durableRequest({ error: { code: '08006', message: 'connection lost' } })
    mocks.sendEmail.mockResolvedValue({ data: { id: 'email-1' }, error: null })

    const response = await POST(receiptRequest())

    await expect(response.json()).resolves.toMatchObject({
      ok: true, requestId: 'withdrawal-1', emailSent: true, reconciliationPending: true,
    })
    const reservation = await mocks.reserveDistributedWithdrawal.mock.results[0].value
    expect(reservation.release).not.toHaveBeenCalled()
  })

  it('confirms the durable receipt only after the email provider accepts it', async () => {
    const update = durableRequest()
    mocks.sendEmail.mockResolvedValue({ data: { id: 'email-1' }, error: null })

    const response = await POST(receiptRequest())

    await expect(response.json()).resolves.toMatchObject({
      ok: true, requestId: 'withdrawal-1', emailSent: true, reconciliationPending: false,
    })
    expect(update).toHaveBeenCalledWith({ status: 'confirmed', confirmed_at: expect.any(String) })
    expect(mocks.sendEmail.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0])
  })

  it('fails closed with a controlled response when the admin client is unavailable', async () => {
    mocks.createAdminClient.mockImplementation(() => { throw new Error('missing service role') })

    const response = await POST(new Request('http://localhost/api/withdrawal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ referenceId: 'withdrawal-admin-client' }),
    }))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Zahtjev trenutno nije moguće zaprimiti.' })
  })

  it('rejects malformed JSON before reserving a withdrawal request', async () => {
    const response = await POST(new Request('http://localhost/api/withdrawal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: '{not-json',
    }))

    expect(response.status).toBe(400)
    expect(mocks.reserveDistributedWithdrawal).not.toHaveBeenCalled()
  })

  it('returns 503 and releases the reservation when the live table is absent', async () => {
    const response = await POST(new Request('http://localhost/api/withdrawal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ referenceId: 'withdrawal-1' }),
    }))

    expect(response.status).toBe(503)
    const reservation = await mocks.reserveDistributedWithdrawal.mock.results[0].value
    expect(reservation.release).toHaveBeenCalledTimes(1)
    expect(reservation.commit).not.toHaveBeenCalled()
  })

  it('retries a transient release failure before returning the setup error', async () => {
    const release = vi.fn()
      .mockRejectedValueOnce(new Error('temporary release failure'))
      .mockResolvedValueOnce(undefined)
    mocks.reserveDistributedWithdrawal.mockResolvedValue({
      allowed: true,
      release,
      commit: vi.fn().mockResolvedValue(undefined),
    })

    const response = await POST(new Request('http://localhost/api/withdrawal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ referenceId: 'withdrawal-retry' }),
    }))

    expect(response.status).toBe(503)
    expect(release).toHaveBeenCalledTimes(2)
  })
})
