import { describe, expect, it } from 'vitest'

import { nextTheme, readStoredTheme, resolveTheme, storeTheme } from './theme'

describe('theme preference', () => {
  it('keeps a valid saved choice ahead of the device preference', () => {
    expect(resolveTheme({ stored: 'dark', prefersDark: false })).toBe('dark')
  })

  it('uses the device preference when there is no valid saved choice', () => {
    expect(resolveTheme({ stored: null, prefersDark: true })).toBe('dark')
    expect(resolveTheme({ stored: 'invalid', prefersDark: false })).toBe('light')
  })

  it('round-trips a manual choice through browser storage', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    storeTheme(storage, 'dark')

    expect(readStoredTheme(storage)).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
  })
})
