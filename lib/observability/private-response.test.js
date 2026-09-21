import { describe, expect, it } from 'vitest'

import { privateJson } from './private-response.js'

describe('private JSON response', () => {
  it('marks account and project responses as non-cacheable', async () => {
    const response = privateJson({ ok: true })

    expect(response.headers.get('cache-control')).toBe('private, no-store')
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('preserves an explicitly stronger cache policy', () => {
    const response = privateJson({ ok: true }, { headers: { 'cache-control': 'no-store' } })

    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
