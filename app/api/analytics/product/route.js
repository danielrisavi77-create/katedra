import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOwnedProjectResult } from '@/lib/academic-suite/repositories/projects'
import { CLIENT_KATEDRA_PRODUCT_EVENTS, KATEDRA_PRODUCT_EVENTS, recordKatedraProductEvent } from '@/lib/analytics/product-events'
import { JSON_BODY_LIMITS, readJsonBody } from '@/lib/http/json-body.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'
import { privateJson } from '@/lib/observability/private-response.js'

export async function POST(request) {
  const origin = validateSameOriginRequest(request, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return privateJson({ error: origin.error }, { status: origin.status })
  const body = await readJsonBody(request, JSON_BODY_LIMITS.account)
  if (!body.ok) return privateJson({ error: body.error }, { status: body.status })
  const value = body.value || {}
  if (!KATEDRA_PRODUCT_EVENTS.includes(value.eventName)) return privateJson({ error: 'Nepoznat product event.' }, { status: 400 })
  if (!CLIENT_KATEDRA_PRODUCT_EVENTS.includes(value.eventName)) {
    return privateJson({ error: 'Ovaj product event može zabilježiti samo server.' }, { status: 403 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const projectId = typeof value.projectId === 'string' ? value.projectId.trim() : ''
  const anonymousFunnelEvent = value.eventName === 'onboarding_started' || value.eventName === 'completion_scan_completed'
  if (!user && !anonymousFunnelEvent) return privateJson({ error: 'Prijavi se.' }, { status: 401 })
  let canonicalProjectId
  if (projectId && user) {
    if (!user) return privateJson({ error: 'Prijavi se.' }, { status: 401 })
    const owned = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId })
    if (!owned.ok) return privateJson({ error: 'Vlasništvo projekta nije moguće provjeriti.' }, { status: 503 })
    if (!owned.value) return privateJson({ error: 'Projekt nije pronađen.' }, { status: 404 })
    canonicalProjectId = owned.value.projectId
  }
  let admin
  try { admin = createAdminClient() } catch { return privateJson({ error: 'Analytics sink nije konfiguriran.' }, { status: 503 }) }
  const result = await recordKatedraProductEvent(admin, { eventName: value.eventName, userId: user?.id, projectId: canonicalProjectId, anonymousId: typeof value.anonymousId === 'string' ? value.anonymousId : undefined, requestId: typeof value.requestId === 'string' ? value.requestId : undefined, idempotencyKey: typeof value.idempotencyKey === 'string' ? value.idempotencyKey : undefined, properties: value.properties && typeof value.properties === 'object' && !Array.isArray(value.properties) ? value.properties : {} })
  return privateJson(result, { status: result.ok ? 200 : 503 })
}
