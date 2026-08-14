import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getStripe: vi.fn(),
  validateCheckoutProject: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/stripe', () => ({ getStripe: mocks.getStripe }))
vi.mock('@/lib/stripe/catalog', () => ({
  KATEDRA_PACKAGES: { diplomski: { eur: 129.9, tokens: 12_000_000, name: 'Diplomski Pass', workType: 'graduate' } },
}))
vi.mock('@/lib/stripe/checkout-validation', () => ({ validateCheckoutProject: mocks.validateCheckoutProject }))

import { POST } from './route'

const projectId = '11111111-1111-4111-8111-111111111111'

function request(body) {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function projectDb(project) {
  return {
    from() {
      const query = {
        select() { return query },
        eq() { return query },
        is() { return query },
        or() { return query },
        gt() { return query },
        async maybeSingle() { return { data: project, error: null } },
      }
      return query
    },
  }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('POST /api/checkout runtime guards', () => {
  it('rejects an anonymous checkout before Stripe initialization', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })

    const response = await POST(request({ package: 'diplomski', projectId }))

    expect(response.status).toBe(401)
    expect(mocks.getStripe).not.toHaveBeenCalled()
  })

  it('rejects an unknown package before querying project ownership', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })

    const response = await POST(request({ package: 'unknown', projectId }))

    expect(response.status).toBe(400)
  })

  it('fails closed before checkout when production project locks are disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    mocks.createClient.mockResolvedValue({
      ...projectDb({ project_id: projectId, work_type_canonical: 'graduate', topic: 'Tema' }),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })

    const response = await POST(request({ package: 'diplomski', projectId, topic: 'Tema', lockConfirmation: true }))

    expect(response.status).toBe(503)
    expect(mocks.getStripe).not.toHaveBeenCalled()
  })

  it('rejects a legacy project validation result before opening Stripe checkout', async () => {
    mocks.createClient.mockResolvedValue({
      ...projectDb({ project_id: 'klegacy', work_type_canonical: 'graduate' }),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })
    mocks.validateCheckoutProject.mockReturnValue({ ok: false, status: 409, error: 'Projekt nije sinkroniziran.' })

    const response = await POST(request({ package: 'diplomski', projectId: 'klegacy' }))

    expect(response.status).toBe(409)
    expect(mocks.getStripe).not.toHaveBeenCalled()
  })
})
