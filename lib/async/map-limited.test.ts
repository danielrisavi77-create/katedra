import { describe, expect, it } from 'vitest'

import { mapWithConcurrency } from './map-limited'

describe('mapWithConcurrency', () => {
  it('does not exceed the configured number of active tasks', async () => {
    let active = 0
    let peak = 0
    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 1))
      active -= 1
      return value * 2
    })

    expect(result).toEqual([2, 4, 6, 8, 10])
    expect(peak).toBeLessThanOrEqual(2)
  })

  it('returns an empty list without starting workers', async () => {
    const mapper = async () => 'unexpected'
    await expect(mapWithConcurrency([], 4, mapper)).resolves.toEqual([])
  })
})
