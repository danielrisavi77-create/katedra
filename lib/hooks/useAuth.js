'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let supabase
    const hardTimeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 5000)

    try {
      supabase = createClient()
    } catch (e) {
      // console.warn, ne error — Next.js dev overlay bi svaki console.error
      // prikazao kao blokirajuću grešku, a ovo je očekivano dok .env.local
      // nema pravi Supabase projekt (vidi README "Postavljanje od nule").
      console.warn('[useAuth] createClient failed:', e)
      clearTimeout(hardTimeout)
      queueMicrotask(() => { if (mounted) setLoading(false) })
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)

      if (event === 'INITIAL_SESSION') {
        clearTimeout(hardTimeout)
        if (mounted) setLoading(false)
      }

    })

    return () => {
      mounted = false
      clearTimeout(hardTimeout)
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
