'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  if (globalThis.__supabaseBrowserClient) return globalThis.__supabaseBrowserClient
  globalThis.__supabaseBrowserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  return globalThis.__supabaseBrowserClient
}
