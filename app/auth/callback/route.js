// app/auth/callback/route.js
// Obrađuje magic-link/email-potvrda/reset-lozinke redirect (PKCE code exchange).

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSafeInternalRedirect } from '@/lib/auth/redirect'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error_description') || searchParams.get('error')
  const redirect = getSafeInternalRedirect(searchParams.get('redirect'))

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
      // Keep auth recovery and email-confirmation links inside the Katedra
      // app that handled the callback. A shared NEXT_PUBLIC_APP_URL can point
      // at Lekta in a cross-repo setup and must not control this redirect.
      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }

  return NextResponse.redirect(`${origin}/prijava?error=auth_callback_failed`)
}
