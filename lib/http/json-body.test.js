import { describe, expect, it } from 'vitest'

import { readJsonBody, readTextBody } from './json-body.js'

describe('readJsonBody', () => {
  it('parses a small JSON request', async () => {
    const result = await readJsonBody(new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ ok: true }),
      headers: { 'content-type': 'application/json' },
    }), 1024)

    expect(result).toEqual({ ok: true, value: { ok: true } })
  })

  it('rejects a body over the limit before JSON parsing', async () => {
    const result = await readJsonBody(new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ text: '123456789' }),
      headers: { 'content-type': 'application/json' },
    }), 10)

    expect(result).toEqual({ ok: false, status: 413, error: 'Zahtjev je prevelik.' })
  })

  it('also enforces the limit when content-length is absent', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"text":"123456789"}'))
          controller.close()
        },
      }),
      duplex: 'half',
      headers: { 'content-type': 'application/json' },
    })

    const result = await readJsonBody(request, 10)

    expect(result).toEqual({ ok: false, status: 413, error: 'Zahtjev je prevelik.' })
  })

  it('returns a generic parse error for malformed JSON', async () => {
    const result = await readJsonBody(new Request('http://localhost/api/test', {
      method: 'POST',
      body: '{not-json',
    }), 1024)

    expect(result).toEqual({ ok: false, status: 400, error: 'Neispravan zahtjev.' })
  })

  it('reads a bounded raw text body for signed webhook payloads', async () => {
    const result = await readTextBody(new Request('http://localhost/api/webhook', {
      method: 'POST',
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('123456789'))
          controller.close()
        },
      }),
      duplex: 'half',
    }), 8)

    expect(result).toEqual({ ok: false, status: 413, error: 'Zahtjev je prevelik.' })
  })
})
