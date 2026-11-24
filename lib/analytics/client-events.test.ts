// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { getClientAnonymousId, recordClientProductEvent } from './client-events'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('client product analytics identity', () => {
  it('keeps one anonymous identity stable across events', () => {
    const first = getClientAnonymousId()
    const second = getClientAnonymousId()

    expect(first).toBe(second)
    expect(first).toBeTruthy()
  })

  it('sends the anonymous identity with the event payload', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    recordClientProductEvent({ eventName: 'onboarding_started', idempotencyKey: `onboarding_started:${getClientAnonymousId()}` })

    expect(fetchMock).toHaveBeenCalledWith('/api/analytics/product', expect.objectContaining({ body: expect.stringContaining(getClientAnonymousId()) }))
  })
})
