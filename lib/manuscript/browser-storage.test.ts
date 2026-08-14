import { describe, expect, it } from 'vitest'

import { readStorage, writeStorage } from './browser-storage'

describe('browser storage safety', () => {
  it('turns read and write exceptions into safe outcomes', () => {
    const broken = {
      getItem() { throw new Error('storage blocked') },
      setItem() { throw new Error('quota exceeded') },
      removeItem() { throw new Error('storage blocked') },
    }

    expect(readStorage(broken, 'key')).toBeNull()
    expect(writeStorage(broken, 'key', 'value')).toBe(false)
  })

  it('writes and reads through a working storage implementation', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem(key: string) { return values.get(key) ?? null },
      setItem(key: string, value: string) { values.set(key, value) },
      removeItem(key: string) { values.delete(key) },
    }

    expect(writeStorage(storage, 'key', 'value')).toBe(true)
    expect(readStorage(storage, 'key')).toBe('value')
  })
})
