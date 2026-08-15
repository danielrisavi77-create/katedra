import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))

import { GET } from './route'

function query(data, error = null) {
  const value = {
    select() { return value },
    eq() { return value },
    or() { return value },
    order() { return value },
    limit() { return value },
    then(resolve) { return Promise.resolve(resolve({ data, error })) },
  }
  return value
}

afterEach(() => vi.clearAllMocks())

describe('GET /api/account', () => {
  it('rejects anonymous users', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('returns an ownership-scoped AI usage summary without document text', async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.com' } } }) },
      from(table) {
        if (table === 'katedra_usage') return query([{ input_tokens: 10, output_tokens: 4, charged: 30 }])
        if (table === 'entitlements') return query([])
        return query([{ project_id: 'project-1', user_id: 'user-1', topic: 'Tema' }])
      },
    })

    const body = await (await GET()).json()

    expect(body.usage).toEqual({ requests: 1, inputTokens: 10, outputTokens: 4, charged: 30 })
    expect(body.projects).toEqual([{ project_id: 'project-1', user_id: 'user-1', topic: 'Tema' }])
    expect(JSON.stringify(body)).not.toContain('manuscript')
  })

  it('keeps the account Pass list aligned with the Katedra product catalog', async () => {
    const passQuery = {
      select() { return passQuery },
      eq() { return passQuery },
      or(value) { passQuery.filter = value; return passQuery },
      order() { return passQuery },
      then(resolve) { return Promise.resolve(resolve({ data: [], error: null })) },
      filter: '',
    }
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from(table) {
        if (table === 'entitlements') return passQuery
        return query([])
      },
    })

    await GET()

    expect(passQuery.filter).toContain('katedra_pass_seminarski')
    expect(passQuery.filter).toContain('katedra_pass_zavrsni')
    expect(passQuery.filter).toContain('katedra_pass_diplomski')
    expect(passQuery.filter).toContain('work_type.in.(seminarski,zavrsni,diplomski)')
  })

  it('excludes unknown legacy null-product entitlements from the Katedra Pass list', async () => {
    const passes = [
      { id: 'other-product', product_id: null, work_type: 'doktorski', status: 'active', purchase_expires_at: '2099-01-01T00:00:00.000Z' },
      { id: 'legacy-zavrsni', product_id: null, work_type: 'zavrsni', status: 'active', purchase_expires_at: '2099-01-01T00:00:00.000Z' },
      { id: 'catalog-pass', product_id: 'katedra_pass_diplomski', work_type: 'anything', status: 'active', purchase_expires_at: '2099-01-01T00:00:00.000Z' },
    ]
    const passQuery = query(passes)
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from(table) {
        if (table === 'entitlements') return passQuery
        return query([])
      },
    })

    const body = await (await GET()).json()

    expect(body.passes).toEqual([passes[1], passes[2]])
  })

  it('does not report an expired active entitlement as active', async () => {
    const passes = [{
      id: 'expired-pass',
      product_id: null,
      work_type: 'seminarski',
      status: 'active',
      purchase_expires_at: '2020-01-01T00:00:00.000Z',
    }]
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from(table) {
        if (table === 'entitlements') return query(passes)
        return query([])
      },
    })

    const body = await (await GET()).json()

    expect(body.passes).toEqual([{ ...passes[0], status: 'expired' }])
  })

  it('does not present unavailable AI usage as a confirmed zero', async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from(table) {
        if (table === 'katedra_usage') return query([], new Error('usage unavailable'))
        return query([])
      },
    })

    const body = await (await GET()).json()

    expect(body.usage).toBeNull()
    expect(body.warnings).toContain('AI potrošnja trenutačno nije dostupna.')
  })

  it('does not present unavailable project or Pass data as empty account state', async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from(table) {
        if (table === 'katedra_projects' || table === 'entitlements') return query([], new Error(`${table} unavailable`))
        return query([])
      },
    })

    const body = await (await GET()).json()

    expect(body.projects).toBeNull()
    expect(body.passes).toBeNull()
    expect(body.warnings).toContain('Projekti trenutačno nisu dostupni.')
    expect(body.warnings).toContain('Status Passova trenutačno nije dostupan.')
  })
})
