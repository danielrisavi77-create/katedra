'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { readStoredTheme, resolveTheme, storeTheme } from '../lib/theme/theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light')
  const hasManualPreference = useRef(false)

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const stored = readStoredTheme(window.localStorage)
    hasManualPreference.current = Boolean(stored)
    const applyTheme = (nextTheme) => {
      document.documentElement.dataset.theme = nextTheme
      setThemeState(nextTheme)
    }
    applyTheme(resolveTheme({ stored, prefersDark: Boolean(media?.matches) }))
    const onDeviceThemeChange = (event) => {
      if (!hasManualPreference.current) applyTheme(event.matches ? 'dark' : 'light')
    }
    media?.addEventListener?.('change', onDeviceThemeChange)
    return () => media?.removeEventListener?.('change', onDeviceThemeChange)
  }, [])

  const setTheme = useCallback((nextTheme) => {
    hasManualPreference.current = true
    storeTheme(window.localStorage, nextTheme)
    document.documentElement.dataset.theme = nextTheme
    setThemeState(nextTheme)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [setTheme, theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
