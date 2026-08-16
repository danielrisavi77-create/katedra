import { createClient } from '@/lib/supabase/server'
import { JSON_BODY_LIMITS, readJsonBody } from '@/lib/http/json-body.js'
import { privateJson } from '@/lib/observability/private-response.js'

export async function POST(request) {
  const parsed = await readJsonBody(request, JSON_BODY_LIMITS.auth)
  if (!parsed.ok) return privateJson({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value

  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password) {
    return privateJson({ error: 'Unesi e-mail adresu i lozinku.' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return privateJson({ error: 'Neispravna e-mail adresa ili lozinka.' }, {
        status: 401,
        headers: { 'Cache-Control': 'private, no-store' },
      })
    }

    return privateJson({ ok: true }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return privateJson({ error: 'Prijava trenutno nije dostupna.' }, {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }
}
