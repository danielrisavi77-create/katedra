import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  cookieStore: { getAll: vi.fn(() => []), set: vi.fn() },
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  })),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mocks.cookieStore),
}))

import { GET } from './route'

describe('GET /auth/callback', () => {
  it.each([
    '',
    '?error_description=private-provider-detail',
    '?code=one-time-code',
  ])('never caches callback redirects: %s', async (query) => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null })
    const response = await GET(new Request(`https://katedra.example/auth/callback${query}`))
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('location')).not.toContain('private-provider-detail')
  })

  it('returns a bounded failure redirect when the exchange rejects', async () => {
    mocks.exchangeCodeForSession.mockRejectedValueOnce(new Error('private-provider-detail'))
    const response = await GET(new Request('https://katedra.example/auth/callback?code=one-time-code'))
    expect(response.headers.get('location')).toBe('https://katedra.example/prijava?error=auth_callback_failed')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('keeps the post-auth redirect on the Katedra request origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lekta.example')
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null })

    const response = await GET(new Request('https://katedra.example/auth/callback?code=one-time-code&redirect=%2Freset-lozinke'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://katedra.example/reset-lozinke')
    vi.unstubAllEnvs()
  })
})
