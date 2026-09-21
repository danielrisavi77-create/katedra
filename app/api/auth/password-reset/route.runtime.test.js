import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))

import { POST } from './route'

function request(body) {
  return new Request('http://localhost:3000/api/auth/password-reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  })
}

function productionRequest(body) {
  return new Request('https://katedra.example/api/auth/password-reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://katedra.example' },
    body: JSON.stringify(body),
  })
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('POST /api/auth/password-reset', () => {
  it('sends a reset link back to the Katedra callback', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
    mocks.createClient.mockResolvedValue({ auth: { resetPasswordForEmail } })
    vi.stubEnv('NODE_ENV', 'development')

    const response = await POST(request({ email: 'daniel@example.com' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(resetPasswordForEmail).toHaveBeenCalledWith('daniel@example.com', {
      redirectTo: 'http://localhost:3000/auth/callback?redirect=%2Freset-lozinke',
    })
  })

  it('does not use a shared Lekta app URL for the recovery callback', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
    mocks.createClient.mockResolvedValue({ auth: { resetPasswordForEmail } })
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lekta.example')

    const response = await POST(productionRequest({ email: 'daniel@example.com' }))

    expect(response.status).toBe(200)
    expect(resetPasswordForEmail).toHaveBeenCalledWith('daniel@example.com', {
      redirectTo: 'https://katedra.example/auth/callback?redirect=%2Freset-lozinke',
    })
  })

  it('does not expose provider details for a failed reset request', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: new Error('provider detail') })
    mocks.createClient.mockResolvedValue({ auth: { resetPasswordForEmail } })

    const response = await POST(request({ email: 'daniel@example.com' }))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Slanje trenutno nije dostupno.' })
  })

  it('returns a clear rate-limit response when Supabase blocks recovery email sends', async () => {
    const error = Object.assign(new Error('429: email rate limit exceeded'), {
      status: 429,
      code: 'over_email_send_rate_limit',
    })
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error })
    mocks.createClient.mockResolvedValue({ auth: { resetPasswordForEmail } })

    const response = await POST(request({ email: 'daniel@example.com' }))

    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.error).toContain('reset lozinke')
    expect(Date.parse(body.retryAt)).toBeGreaterThan(Date.now())
    expect(response.headers.get('Retry-After')).toBe('60')
  })

  it('uses Supabase Retry-After when it is available', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T20:00:00.000Z'))

    const error = Object.assign(new Error('429: email rate limit exceeded'), {
      status: 429,
      code: 'over_email_send_rate_limit',
    })
    let clientOptions
    mocks.createClient.mockImplementation(async (options) => {
      clientOptions = options
      await options.global.fetch('https://supabase.test/auth/v1/recover')
      return { auth: { resetPasswordForEmail: vi.fn().mockResolvedValue({ error }) } }
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(null, { status: 429, headers: { 'Retry-After': '120' } })
    ))

    const response = await POST(request({ email: 'daniel@example.com' }))
    const body = await response.json()

    expect(clientOptions.global.fetch).toBeTypeOf('function')
    expect(body.retryAt).toBe('2026-08-15T20:02:00.000Z')
    expect(response.headers.get('Retry-After')).toBe('120')
  })

  it('rejects an empty email before calling Supabase', async () => {
    const resetPasswordForEmail = vi.fn()
    mocks.createClient.mockResolvedValue({ auth: { resetPasswordForEmail } })

    const response = await POST(request({ email: '' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unesi e-mail adresu.' })
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })
})
