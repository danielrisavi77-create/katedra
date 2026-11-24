import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolveOwnedProjectResult: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({ resolveOwnedProjectResult: mocks.resolveOwnedProjectResult }))

import { GET } from './route'

const projectId = '00000000-0000-4000-8000-000000000001'

function requestFor(value = projectId) {
  return new Request(`http://localhost/api/reminders/deadline?projectId=${encodeURIComponent(value)}`)
}

function createSubscriptionQuery(result) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  return query
}

beforeEach(() => {
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  })
  mocks.resolveOwnedProjectResult.mockResolvedValue({ ok: true, value: { projectId, workType: 'd' } })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/reminders/deadline', () => {
  it('returns the active subscription state for the owned project', async () => {
    const query = createSubscriptionQuery({ data: { deadline_date: '2026-09-01', consent_at: '2026-08-22T10:00:00.000Z' }, error: null })
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(() => query),
    })

    const response = await GET(requestFor())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ enabled: true, deadline: '2026-09-01' })
    expect(query.is).toHaveBeenCalledWith('unsubscribed_at', null)
  })

  it('returns disabled when the user has no active subscription', async () => {
    const query = createSubscriptionQuery({ data: null, error: null })
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(() => query),
    })

    const response = await GET(requestFor())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ enabled: false, deadline: null })
  })

  it('does not expose reminder state for another project', async () => {
    mocks.resolveOwnedProjectResult.mockResolvedValue({ ok: true, value: null })

    const response = await GET(requestFor())

    expect(response.status).toBe(404)
  })

  it('requires an authenticated user', async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const response = await GET(requestFor())

    expect(response.status).toBe(401)
  })
})
