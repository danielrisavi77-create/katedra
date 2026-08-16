import { createClient } from '@/lib/supabase/server'
import { JSON_BODY_LIMITS, readJsonBody } from '@/lib/http/json-body.js'
import { privateJson } from '@/lib/observability/private-response.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'
import {
  DEFAULT_RETRY_AFTER_SECONDS,
  parseRetryAfter,
  retryAtFromSeconds,
} from '@/lib/auth/retry-after'

export async function POST(request) {
  const origin = validateSameOriginRequest(request, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return privateJson({ error: origin.error }, { status: origin.status })
  const parsed = await readJsonBody(request, JSON_BODY_LIMITS.auth)
  if (!parsed.ok) return privateJson({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value

  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  if (!email) return privateJson({ error: 'Unesi e-mail adresu.' }, { status: 400 })

  let upstreamRetryAfter = null

  try {
    const supabase = await createClient({
      global: {
        fetch: async (...args) => {
          const response = await fetch(...args)
          if (response.status === 429) {
            upstreamRetryAfter = response.headers.get('Retry-After')
          }
          return response
        },
      },
    })
    const callback = new URL('/auth/callback', resolveAppOrigin(request))
    callback.searchParams.set('redirect', '/reset-lozinke')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callback.toString(),
    })
    if (error) {
      const rateLimited = error?.status === 429 || error?.code === 'over_email_send_rate_limit'
      if (rateLimited) {
        const retryAfterSeconds = parseRetryAfter(upstreamRetryAfter) ?? DEFAULT_RETRY_AFTER_SECONDS
        return privateJson({
          error: 'Previše zahtjeva za reset lozinke. Pričekaj malo pa pokušaj ponovno.',
          retryAt: retryAtFromSeconds(retryAfterSeconds),
        }, {
          status: 429,
          headers: {
            'Cache-Control': 'private, no-store',
            'Retry-After': String(retryAfterSeconds),
          },
        })
      }

      return privateJson({
        error: 'Slanje trenutno nije dostupno.',
      }, {
        status: 503,
        headers: { 'Cache-Control': 'private, no-store' },
      })
    }

    return privateJson({ ok: true }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return privateJson({ error: 'Slanje trenutno nije dostupno.' }, {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }
}

function resolveAppOrigin(request) {
  // The recovery request already arrived at Katedra. Keep the callback on
  // that origin; NEXT_PUBLIC_APP_URL is shared by some local setups and may
  // point at Lekta, which would send the user into the wrong application.
  return new URL(request.url).origin
}
