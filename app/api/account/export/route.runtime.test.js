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

describe('GET /api/account/export', () => {
  it('rejects anonymous requests without a cacheable response', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })

    const response = await GET()

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('exports owned project metadata, Passes and usage without manuscript text', async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.com' } } }) },
      from(table) {
        if (table === 'katedra_projects') return query([{ project_id: 'project-1', topic: 'Tema' }])
        if (table === 'entitlements') return query([{ id: 'pass-1', product_id: 'katedra_pass_zavrsni', status: 'active', purchase_expires_at: '2099-01-01T00:00:00.000Z' }])
        if (table === 'katedra_usage') return query([{ input_tokens: 10, output_tokens: 4, charged: 30 }])
        return query([])
      },
    })

    const body = await (await GET()).json()

    expect(body.projects).toEqual([{ project_id: 'project-1', topic: 'Tema' }])
    expect(body.passes).toEqual([{ id: 'pass-1', product_id: 'katedra_pass_zavrsni', status: 'active', purchase_expires_at: '2099-01-01T00:00:00.000Z' }])
    expect(body.usage).toEqual({ requests: 1, inputTokens: 10, outputTokens: 4, charged: 30 })
    expect(JSON.stringify(body)).not.toContain('manuscript')
  })
})
