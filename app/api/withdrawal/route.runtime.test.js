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
})
