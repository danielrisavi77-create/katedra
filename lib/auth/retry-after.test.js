import { describe, expect, it } from 'vitest'
import { parseRetryAfter, retryAtFromSeconds } from './retry-after'

describe('Retry-After helpers', () => {
  it('parses a delta-seconds value', () => {
    expect(parseRetryAfter('120', Date.parse('2026-08-15T20:00:00.000Z'))).toBe(120)
  })

  it('parses an HTTP date and rounds up to the next second', () => {
    const now = Date.parse('2026-08-15T20:00:00.500Z')
    expect(parseRetryAfter('Sat, 15 Aug 2026 20:00:02 GMT', now)).toBe(2)
  })

  it('rejects malformed values', () => {
    expect(parseRetryAfter('not-a-duration')).toBeNull()
  })

  it('creates an ISO retry timestamp', () => {
    const now = Date.parse('2026-08-15T20:00:00.000Z')
    expect(retryAtFromSeconds(60, now)).toBe('2026-08-15T20:01:00.000Z')
  })
})
