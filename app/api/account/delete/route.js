import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteUserAgentPayloads } from '@/lib/agents/run-payload-deletion'
import { JSON_BODY_LIMITS, readJsonBody } from '@/lib/http/json-body.js'
import { privateJson } from '@/lib/observability/private-response.js'
import { logOperationalEvent } from '@/lib/observability/operational-events'
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
  let admin
  try {
    admin = createAdminClient()
  } catch (error) {
    logOperationalEvent({ eventName: 'account_delete_admin_client_unavailable', userId: user.id, error }, 'error')
    return privateJson({ error: 'Brisanje računa trenutačno nije dostupno.' }, { status: 503 })
  }

  const payloads = await deleteUserAgentPayloads(admin, { userId: user.id })
  if (!payloads.ok) {
    logOperationalEvent({ eventName: 'account_delete_payload_cleanup_blocked', userId: user.id, reason: payloads.status, error: payloads.error }, 'error')
    return privateJson({ error: payloads.error }, { status: 503 })
  }

  let deleted
  try {
    deleted = await admin.auth.admin.deleteUser(user.id)
  } catch (error) {
    logOperationalEvent({ eventName: 'account_delete_identity_failed_after_payload_cleanup', userId: user.id, error }, 'error')
    return privateJson({ error: 'Privremeni podaci su uklonjeni, ali canonical identity servis trenutačno nije dovršio brisanje računa.' }, { status: 503 })
  }
  if (deleted.error) {
    logOperationalEvent({ eventName: 'account_delete_identity_failed_after_payload_cleanup', userId: user.id, error: deleted.error }, 'error')
    return privateJson({ error: 'Privremeni podaci su uklonjeni, ali canonical identity servis trenutačno nije dovršio brisanje računa.' }, { status: 503 })
  }
  return privateJson({ deleted: true, temporaryPayloads: payloads.deleted })
}
