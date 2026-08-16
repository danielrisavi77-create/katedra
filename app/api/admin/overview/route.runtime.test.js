import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getAdminAccess: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/auth/admin-access', () => ({ getAdminAccess: mocks.getAdminAccess }))

import { GET } from './route'

function query(data, error = null) {
  const value = {
    select() { return value },
    eq() { return value },
    order() { return value },
    limit() { return value },
    then(resolve) { return Promise.resolve(resolve({ data, error })) },
  }
  return value
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('GET /api/admin/overview', () => {
  it('rejects an anonymous request before creating an admin client', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })

    const response = await GET()

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('rejects a signed-in non-admin without querying account data', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'student@example.com' } } }) } })
    mocks.getAdminAccess.mockReturnValue({ allowed: false, reason: 'email_not_allowlisted' })

    const response = await GET()

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('returns an ownership-filtered operational overview without manuscript text or the allowlist', async () => {
    const user = { id: 'user-daniel', email: 'danielrisavi77@gmail.com', email_confirmed_at: '2026-08-15T10:00:00.000Z' }
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } })
    mocks.getAdminAccess.mockReturnValue({ allowed: true, reason: 'allowlisted_confirmed_email' })
    mocks.createAdminClient.mockReturnValue({
      from(table) {
        if (table === 'katedra_projects') return query([{ project_id: 'project-1', topic: 'Tema', user_id: 'user-daniel' }])
        if (table === 'agent_runs') return query([{ run_id: 'run-1', project_id: 'project-1', status: 'running' }])
        if (table === 'katedra_usage') return query([{ input_tokens: 10, output_tokens: 4, charged: 30 }])
        return query([])
      },
    })
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_AGENT_RUNS_ENABLED', 'false')
    vi.stubEnv('KATEDRA_MATERIALS_ENABLED', 'false')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.admin).toEqual({ enabled: true, reason: 'allowlisted_confirmed_email' })
    expect(body.user).toEqual({ id: 'user-daniel', email: 'danielrisavi77@gmail.com' })
    expect(body.projects).toEqual([{ project_id: 'project-1', topic: 'Tema', user_id: 'user-daniel' }])
    expect(body.agentRuns).toEqual([{ run_id: 'run-1', project_id: 'project-1', status: 'running' }])
    expect(body.usage).toEqual({ requests: 1, inputTokens: 10, outputTokens: 4, charged: 30 })
    expect(body.featureFlags).toEqual({ projectLocks: true, agentRuns: false, materials: false, billingContract: 'v2' })
    expect(JSON.stringify(body)).not.toContain('KATEDRA_ADMIN_EMAILS')
    expect(JSON.stringify(body)).not.toContain('manuscript')
  })

  it('returns a controlled service-unavailable response when the admin client is not configured', async () => {
    const user = { id: 'user-daniel', email: 'danielrisavi77@gmail.com', email_confirmed_at: '2026-08-15T10:00:00.000Z' }
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } })
    mocks.getAdminAccess.mockReturnValue({ allowed: true, reason: 'allowlisted_confirmed_email' })
    mocks.createAdminClient.mockImplementation(() => { throw new Error('missing service role') })

    const response = await GET()

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Admin pregled trenutno nije dostupan.' })
  })
})
