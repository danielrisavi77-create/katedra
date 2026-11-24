import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  resolveOwnedProjectResult: vi.fn(),
  recordKatedraProductEvent: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({ resolveOwnedProjectResult: mocks.resolveOwnedProjectResult }))
vi.mock('@/lib/analytics/product-events', () => ({
  KATEDRA_PRODUCT_EVENTS: ['onboarding_started', 'completion_scan_completed', 'first_ai_request', 'project_completed'],
  CLIENT_KATEDRA_PRODUCT_EVENTS: ['onboarding_started', 'completion_scan_completed', 'first_ai_request'],
  recordKatedraProductEvent: mocks.recordKatedraProductEvent,
}))

import { POST } from './route'

function request(body) {
  return new Request('http://localhost:3000/api/analytics/product', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  })
}

afterEach(() => vi.clearAllMocks())

describe('POST /api/analytics/product', () => {
  it('accepts an anonymous completion scan without treating a local project id as owned server data', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.recordKatedraProductEvent.mockResolvedValue({ ok: true })

    const response = await POST(request({ eventName: 'completion_scan_completed', projectId: 'guest-project', anonymousId: 'anon-1', idempotencyKey: 'scan:anon-1' }))

    expect(response.status).toBe(200)
    expect(mocks.resolveOwnedProjectResult).not.toHaveBeenCalled()
    expect(mocks.recordKatedraProductEvent).toHaveBeenCalledWith({}, expect.objectContaining({ eventName: 'completion_scan_completed', anonymousId: 'anon-1', projectId: undefined, userId: undefined }))
  })

  it('keeps non-funnel product events authenticated', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })

    const response = await POST(request({ eventName: 'first_ai_request' }))

    expect(response.status).toBe(401)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('canonicalizes an authenticated project before recording the event', async () => {
    const user = { id: 'user-1' }
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } })
    mocks.resolveOwnedProjectResult.mockResolvedValue({ ok: true, value: { projectId: 'canonical-project' } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.recordKatedraProductEvent.mockResolvedValue({ ok: true })

    const response = await POST(request({ eventName: 'completion_scan_completed', projectId: 'client-alias' }))

    expect(response.status).toBe(200)
    expect(mocks.resolveOwnedProjectResult).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1', projectId: 'client-alias' })
    expect(mocks.recordKatedraProductEvent).toHaveBeenCalledWith({}, expect.objectContaining({ projectId: 'canonical-project', userId: 'user-1' }))
  })

  it('rejects project completion claims from the browser analytics endpoint', async () => {
    const user = { id: 'user-1' }
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } })
    mocks.resolveOwnedProjectResult.mockResolvedValue({ ok: true, value: { projectId: 'canonical-project' } })

    const response = await POST(request({ eventName: 'project_completed', projectId: 'canonical-project' }))

    expect(response.status).toBe(403)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    expect(mocks.recordKatedraProductEvent).not.toHaveBeenCalled()
  })
})
