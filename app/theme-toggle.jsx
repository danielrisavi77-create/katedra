'use client'

import { nextTheme } from '../lib/theme/theme'
import { useTheme } from './theme-provider'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = nextTheme(theme)
  const label = next === 'light' ? 'Uključi svijetlu temu' : 'Uključi tamnu temu'

  return <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={() => setTheme(next)}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span></button>
}
