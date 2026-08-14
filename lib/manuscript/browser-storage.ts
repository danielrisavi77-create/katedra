type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function readStorage(storage: StorageLike | null | undefined, key: string): string | null {
  if (!storage) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(storage: StorageLike | null | undefined, key: string, value: string): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}
