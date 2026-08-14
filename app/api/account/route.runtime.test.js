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
  })

  it('does not report an expired active entitlement as active', async () => {
    const passes = [{
      id: 'expired-pass',
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
})
