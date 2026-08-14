import { describe, expect, it } from 'vitest'

import { getRequestId, withRequestId } from './request-id.js'

describe('request id observability', () => {
  it('accepts a safe incoming request id', () => {
    const request = new Request('http://localhost/api/test', {
      headers: { 'x-request-id': 'checkout-test-123' },
    })

    expect(getRequestId(request)).toBe('checkout-test-123')
  })

  it('replaces oversized or control-character ids', () => {
    const request = new Request('http://localhost/api/test', {
      headers: { 'x-request-id': `bad-${'x'.repeat(140)}` },
    })

    expect(getRequestId(request)).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('adds the id to an existing response without changing its body', async () => {
    const response = withRequestId(Response.json({ ok: true }), 'request-42')

    expect(response.headers.get('x-request-id')).toBe('request-42')
    await expect(response.json()).resolves.toEqual({ ok: true })
  })
})
