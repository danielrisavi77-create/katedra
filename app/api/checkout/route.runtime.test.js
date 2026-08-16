import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getStripe: vi.fn(),
  validateCheckoutProject: vi.fn(),
  validateCheckoutConfirmation: vi.fn(),
  isAdminOverrideUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/stripe', () => ({ getStripe: mocks.getStripe }))
vi.mock('@/lib/stripe/catalog', () => ({
  KATEDRA_PACKAGES: { diplomski: { eur: 129.9, tokens: 12_000_000, name: 'Diplomski Pass', workType: 'graduate' } },
}))
vi.mock('@/lib/stripe/checkout-validation', () => ({
  validateCheckoutProject: mocks.validateCheckoutProject,
  validateCheckoutConfirmation: mocks.validateCheckoutConfirmation,
}))
vi.mock('@/lib/auth/admin-access', () => ({ isAdminOverrideUser: mocks.isAdminOverrideUser }))

import { POST } from './route'

const projectId = '11111111-1111-4111-8111-111111111111'

function request(body) {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost' },
    body: JSON.stringify(body),
  })
}

function projectDb(project, responses = []) {
  let call = 0
  return {
    from() {
      const query = {
        select() { return query },
        eq() { return query },
        is() { return query },
        or() { return query },
        gt() { return query },
        limit() { return query },
        async maybeSingle() {
          const response = responses[call++] || { data: project, error: null }
          return response
        },
      }
      return query
    },
  }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

beforeEach(() => {
  mocks.isAdminOverrideUser.mockReturnValue(false)
  mocks.validateCheckoutConfirmation.mockReturnValue({ ok: true })
})

describe('POST /api/checkout runtime guards', () => {
  it('resolves a legacy guest alias to the owned canonical project before checkout', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
    const canonicalProjectId = projectId
    mocks.createClient.mockResolvedValue({
      ...projectDb(
        { user_id: 'user-1', project_id: canonicalProjectId, guest_project_id: 'klegacy', work_type_canonical: 'graduate', topic: 'Tema' },
        [
          { data: { user_id: 'user-1', project_id: canonicalProjectId, guest_project_id: 'klegacy' }, error: null },
          { data: { project_id: canonicalProjectId, work_type_canonical: 'graduate', topic: 'Tema' }, error: null },
          { data: null, error: null },
        ],
      ),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })
    mocks.validateCheckoutProject.mockReturnValue({ ok: true })
    mocks.getStripe.mockReturnValue({
      checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.test/session' }) } },
    })

    const response = await POST(request({ package: 'diplomski', projectId: 'klegacy', topic: 'Tema', lockConfirmation: true }))

    expect(response.status).toBe(200)
    expect(mocks.validateCheckoutProject).toHaveBeenCalledWith({ projectId: canonicalProjectId, workTypeCanonical: 'graduate' }, 'diplomski')
  })

  it('does not create a Stripe session for the explicit admin override account', async () => {
    mocks.createClient.mockResolvedValue({
      ...projectDb({ project_id: projectId, work_type_canonical: 'graduate', topic: 'Tema' }),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-daniel', email: 'danielrisavi77@gmail.com', email_confirmed_at: '2026-08-15T10:00:00.000Z' } } }) },
    })
    mocks.isAdminOverrideUser.mockReturnValue(true)

    const response = await POST(request({ package: 'diplomski', projectId, topic: 'Tema', lockConfirmation: true }))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Ovaj račun ima aktivan admin pristup; plaćanje nije potrebno.', adminOverride: true })
    expect(mocks.getStripe).not.toHaveBeenCalled()
  })

  it('does not bypass checkout for the admin allowlist in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
    mocks.createClient.mockResolvedValue({
      ...projectDb({ project_id: projectId, work_type_canonical: 'graduate', topic: 'Tema' }, [
        { data: { user_id: 'user-daniel', project_id: projectId, guest_project_id: null, work_type_canonical: 'graduate', topic: 'Tema' }, error: null },
        { data: { project_id: projectId, work_type_canonical: 'graduate', topic: 'Tema' }, error: null },
        { data: null, error: null },
      ]),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-daniel', email: 'danielrisavi77@gmail.com', email_confirmed_at: '2026-08-15T10:00:00.000Z' } } }) },
    })
    mocks.isAdminOverrideUser.mockReturnValue(true)
    mocks.validateCheckoutProject.mockReturnValue({ ok: true })
    const create = vi.fn().mockResolvedValue({ url: 'https://checkout.test/session' })
    mocks.getStripe.mockReturnValue({ checkout: { sessions: { create } } })

    const response = await POST(request({ package: 'diplomski', projectId, topic: 'Tema', lockConfirmation: true }))

    expect(response.status).toBe(200)
    expect(create).toHaveBeenCalled()
  })

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

  it('fails closed before checkout when production billing contract is not v2', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'legacy')
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

  it('fails clearly when the public checkout URL is not configured', async () => {
    mocks.createClient.mockResolvedValue({
      ...projectDb(
        { project_id: projectId, work_type_canonical: 'graduate', topic: 'Tema' },
        [
          { data: { project_id: projectId, work_type_canonical: 'graduate', topic: 'Tema' }, error: null },
          { data: { project_id: projectId, work_type_canonical: 'graduate', topic: 'Tema' }, error: null },
          { data: null, error: null },
        ],
      ),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })
    mocks.validateCheckoutProject.mockReturnValue({ ok: true })

    const response = await POST(request({ package: 'diplomski', projectId, topic: 'Tema', lockConfirmation: true }))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Plaćanje trenutno nije konfigurirano.' })
    expect(mocks.getStripe).not.toHaveBeenCalled()
  })
})
