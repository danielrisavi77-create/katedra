import { afterEach, describe, expect, it } from 'vitest'

import { reserveDocxUpload, resetDocxRateLimiterForTests } from './rate-limit'

afterEach(() => resetDocxRateLimiterForTests())

describe('reserveDocxUpload', () => {
  it('limits repeated DOCX parsing attempts for one user', () => {
    const results = Array.from({ length: 4 }, () => {
      const result = reserveDocxUpload('user-1', 1000)
      if (result.allowed) result.release()
      return result
    })

    expect(results.slice(0, 3).every((result) => result.allowed)).toBe(true)
    expect(results[3]).toMatchObject({ allowed: false, reason: 'rate' })
  })
})
