// app/auth/callback/route.js
// Obrađuje magic-link/email-potvrda/reset-lozinke redirect (PKCE code exchange).

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error_description') || searchParams.get('error')
  const redirectRaw = searchParams.get('redirect') ?? '/'
  // Sigurnost: dozvoli samo relativne, same-origin putanje (spriječi open redirect)
  const redirect = (redirectRaw.startsWith('/') && !redirectRaw.startsWith('//') && !redirectRaw.startsWith('/\\'))
    ? redirectRaw
    : '/'

  if (oauthError) {
    return NextResponse.redirect(`${origin}/prijava?error=${encodeURIComponent(oauthError)}`)
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const isLocalEnv = process.env.NODE_ENV === 'development'
      const base = isLocalEnv ? origin : (process.env.NEXT_PUBLIC_APP_URL || origin)
      return NextResponse.redirect(`${base}${redirect}`)
    }
  }

  return NextResponse.redirect(`${origin}/prijava?error=auth_callback_failed`)
}
