import { createClient } from '@/lib/supabase/server'
import { JSON_BODY_LIMITS, readJsonBody } from '@/lib/http/json-body.js'
import { privateJson } from '@/lib/observability/private-response.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'

export async function POST(request) {
  const origin = validateSameOriginRequest(request, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return privateJson({ error: origin.error }, { status: origin.status })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return privateJson({ error: 'Prijavi se.' }, { status: 401 })
  const parsed = await readJsonBody(request, JSON_BODY_LIMITS.account)
  if (!parsed.ok) return privateJson({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value
  if (body?.confirmation !== 'OBRIŠI RAČUN') return privateJson({ error: 'Potrebna je eksplicitna potvrda.' }, { status: 400 })
  if (process.env.KATEDRA_ACCOUNT_DELETE_ENABLED !== 'true') {
    return privateJson({ error: 'Brisanje računa još nije aktivirano na canonical backendu.' }, { status: 503 })
  }
  return privateJson({ error: 'Brisanje računa mora izvršiti canonical identity servis.' }, { status: 503 })
}
