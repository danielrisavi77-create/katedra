import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  isDistributedWithdrawalConfigured: vi.fn(),
  reserveDistributedWithdrawal: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/security/withdrawal-reservation', () => ({
  isDistributedWithdrawalConfigured: mocks.isDistributedWithdrawalConfigured,
  reserveDistributedWithdrawal: mocks.reserveDistributedWithdrawal,
}))
vi.mock('@/lib/security/withdrawal-limit', () => ({ reserveWithdrawal: vi.fn() }))
vi.mock('resend', () => ({ Resend: vi.fn() }))

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
  it('fails closed with a controlled response when the admin client is unavailable', async () => {
    mocks.createAdminClient.mockImplementation(() => { throw new Error('missing service role') })

    const response = await POST(new Request('http://localhost/api/withdrawal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ referenceId: 'withdrawal-admin-client' }),
    }))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Zahtjev trenutno nije moguće zaprimiti.' })
  })

  it('rejects malformed JSON before reserving a withdrawal request', async () => {
    const response = await POST(new Request('http://localhost/api/withdrawal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    }))

    expect(response.status).toBe(400)
    expect(mocks.reserveDistributedWithdrawal).not.toHaveBeenCalled()
  })

  it('returns 503 and releases the reservation when the live table is absent', async () => {
    const response = await POST(new Request('http://localhost/api/withdrawal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ referenceId: 'withdrawal-retry' }),
    }))

    expect(response.status).toBe(503)
    expect(release).toHaveBeenCalledTimes(2)
  })
})
