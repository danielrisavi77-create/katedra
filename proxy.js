// proxy.js  <- ide u ROOT projekta (uz next.config.js)
// Next.js konvencija koja zamjenjuje middleware.js — osvježava Supabase sesiju.

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function proxy(request) {
  // Prije nego je Supabase projekt postavljen (prazan .env.local), ne pucaj —
  // samo preskoči session-refresh. Ukloniti ovaj guard nema smisla; ako env
  // varijable nedostaju u produkciji, to je zaseban, glasniji problem.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // VAŽNO: ne pisati kod između createServerClient i getUser()
  const { data: { user } } = await supabase.auth.getUser()

  // Prijavljeni korisnik na auth rutama → natrag na wizard.
  const authRoutes = ['/prijava', '/registracija']
  if (authRoutes.includes(request.nextUrl.pathname) && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|auth/callback|api/).*)',
  ],
}
