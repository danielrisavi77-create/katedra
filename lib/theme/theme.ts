export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'katedra-theme'

export function resolveTheme({ stored, prefersDark }: { stored: string | null; prefersDark: boolean }): Theme {
  return isTheme(stored) ? stored : prefersDark ? 'dark' : 'light'
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'light' ? 'dark' : 'light'
}

export function readStoredTheme(storage: Pick<Storage, 'getItem'>): Theme | null {
  const value = storage.getItem(THEME_STORAGE_KEY)
  return isTheme(value) ? value : null
}

export function storeTheme(storage: Pick<Storage, 'setItem'>, theme: Theme): void {
  storage.setItem(THEME_STORAGE_KEY, theme)
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}
