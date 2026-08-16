import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  reserveDocxUpload: vi.fn(),
  isDistributedRateLimitConfigured: vi.fn(),
  reserveDistributedRequest: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/docx/rate-limit', () => ({ reserveDocxUpload: mocks.reserveDocxUpload }))
vi.mock('@/lib/ai/rate-limit', () => ({
  isDistributedRateLimitConfigured: mocks.isDistributedRateLimitConfigured,
  reserveDistributedRequest: mocks.reserveDistributedRequest,
}))

import { POST } from './route'

function request() {
  return new Request('http://localhost/api/parse-docx', { method: 'POST', headers: { origin: 'http://localhost' } })
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('POST /api/parse-docx runtime guards', () => {
  it('fails closed in production when the distributed rate-limit store is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })
    mocks.isDistributedRateLimitConfigured.mockReturnValue(false)

    const response = await POST(request())

    expect(response.status).toBe(503)
    expect(mocks.reserveDocxUpload).not.toHaveBeenCalled()
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('uses the distributed reservation before parsing a production upload', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })
    mocks.createAdminClient.mockReturnValue({})
    mocks.isDistributedRateLimitConfigured.mockReturnValue(true)
    mocks.reserveDistributedRequest.mockResolvedValue({ allowed: false, reason: 'unavailable' })

    const response = await POST(request())

    expect(response.status).toBe(503)
    expect(mocks.reserveDistributedRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'user-1',
      requestId: expect.any(String),
      estimatedCharge: 0,
    }))
    expect(mocks.reserveDocxUpload).not.toHaveBeenCalled()
  })
})
