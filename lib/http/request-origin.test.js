import { describe, expect, it } from 'vitest'

import { validateSameOriginRequest } from './request-origin.js'

describe('validateSameOriginRequest', () => {
  it('accepts same-origin browser requests', () => {
    const request = new Request('https://katedra.test/api/state', {
      method: 'PUT',
      headers: {
        origin: 'https://katedra.test',
        'sec-fetch-site': 'same-origin',
      },
    })

    expect(validateSameOriginRequest(request)).toEqual({ ok: true })
  })

  it('rejects a cross-site fetch even when the request URL is valid', () => {
    const request = new Request('https://katedra.test/api/state', {
      method: 'PUT',
      headers: {
        origin: 'https://evil.example',
        'sec-fetch-site': 'cross-site',
      },
    })

    expect(validateSameOriginRequest(request)).toEqual({
      ok: false,
      status: 403,
      error: 'Zahtjev nije poslan iz dopuštenog izvora.',
    })
  })

  it('rejects a mismatched Origin header even without Fetch Metadata', () => {
    const request = new Request('https://katedra.test/api/state', {
      method: 'PUT',
      headers: { origin: 'https://evil.example' },
    })

    expect(validateSameOriginRequest(request).ok).toBe(false)
  })

  it('rejects missing Origin by default for cookie-authenticated mutations', () => {
    const request = new Request('https://katedra.test/api/state', { method: 'PUT' })

    expect(validateSameOriginRequest(request)).toEqual({
      ok: false,
      status: 403,
      error: 'Zahtjev nije poslan iz dopuštenog izvora.',
    })
  })

  it('allows missing Origin only when the caller opts into server-to-server compatibility', () => {
    const request = new Request('https://katedra.test/api/state', { method: 'PUT' })

    expect(validateSameOriginRequest(request, { allowMissingOrigin: true })).toEqual({ ok: true })
  })

  it('allows an explicitly configured first-party origin', () => {
    const request = new Request('https://preview.katedra.test/api/state', {
      method: 'PUT',
      headers: { origin: 'https://app.katedra.test', 'sec-fetch-site': 'same-site' },
    })

    expect(validateSameOriginRequest(request, { allowedOrigins: ['https://app.katedra.test'] })).toEqual({ ok: true })
  })
})
