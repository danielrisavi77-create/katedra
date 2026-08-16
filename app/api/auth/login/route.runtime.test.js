import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))

import { POST } from './route'

function request(body) {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/login', () => {
  it('establishes a server-side session for valid credentials', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null })
    mocks.createClient.mockResolvedValue({ auth: { signInWithPassword } })

    const response = await POST(request({ email: 'daniel@example.com', password: 'correct horse battery staple' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'daniel@example.com',
      password: 'correct horse battery staple',
    })
  })

  it('does not reveal provider auth details for invalid credentials', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: new Error('provider detail') })
    mocks.createClient.mockResolvedValue({ auth: { signInWithPassword } })

    const response = await POST(request({ email: 'daniel@example.com', password: 'wrong' }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Neispravna e-mail adresa ili lozinka.' })
  })

  it('rejects malformed login payloads before calling Supabase', async () => {
    const signInWithPassword = vi.fn()
    mocks.createClient.mockResolvedValue({ auth: { signInWithPassword } })

    const response = await POST(request({ email: '', password: '' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unesi e-mail adresu i lozinku.' })
    expect(signInWithPassword).not.toHaveBeenCalled()
  })
})
