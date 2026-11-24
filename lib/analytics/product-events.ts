import { logOperationalEvent } from '../observability/operational-events'

export const KATEDRA_PRODUCT_EVENTS = [
  'onboarding_started', 'completion_scan_completed', 'project_attached', 'first_section_written', 'first_ai_request', 'ai_proposal_accepted', 'pass_dialog_opened', 'checkout_started', 'purchase_completed', 'agent_run_started', 'agent_run_completed', 'docx_exported', 'lekta_handoff_started', 'lekta_recheck_completed', 'project_completed',
] as const
export type KatedraProductEventName = typeof KATEDRA_PRODUCT_EVENTS[number]

// Browser telemetry may describe a user action, but it must never be allowed
// to assert a payment, a worker result, a canonical Lekta recheck, or a
// completed project. Those events are emitted by trusted server paths only.
export const CLIENT_KATEDRA_PRODUCT_EVENTS = [
  'onboarding_started', 'completion_scan_completed', 'project_attached',
  'first_section_written', 'first_ai_request', 'ai_proposal_accepted',
  'pass_dialog_opened', 'checkout_started', 'docx_exported',
  'lekta_handoff_started',
] as const
export type ClientKatedraProductEventName = typeof CLIENT_KATEDRA_PRODUCT_EVENTS[number]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ProductEventInput = { eventName: KatedraProductEventName; userId?: string; projectId?: string; anonymousId?: string; requestId?: string; idempotencyKey?: string; properties?: Record<string, unknown>; occurredAt?: string }

export async function recordKatedraProductEvent(db: { from: (table: string) => any }, input: ProductEventInput): Promise<{ ok: boolean; duplicate?: boolean }> {
  const row = {
    event_name: input.eventName,
    app: 'katedra',
    occurred_at: input.occurredAt || new Date().toISOString(),
    ...(input.userId && UUID.test(input.userId) ? { user_id: input.userId } : {}),
    ...(input.projectId && UUID.test(input.projectId) ? { project_id: input.projectId } : {}),
    ...(input.anonymousId ? { anonymous_id: input.anonymousId.slice(0, 120) } : {}),
    ...(input.requestId ? { request_id: input.requestId.slice(0, 120) } : {}),
    ...(input.idempotencyKey ? { idempotency_key: input.idempotencyKey.slice(0, 180) } : {}),
    properties: sanitizeProperties(input.properties || {}),
  }
  try {
    const { error } = await db.from('katedra_product_events').insert(row)
    if (error?.code === '23505') return { ok: true, duplicate: true }
    if (error) throw error
    return { ok: true }
  } catch (error) {
    logOperationalEvent({ eventName: 'katedra_product_event_failed', error, productEvent: input.eventName }, 'error')
    return { ok: false }
  }
}

export function sanitizeProperties(input: Record<string, unknown>): Record<string, unknown> {
  const entries: Array<[string, string | number | boolean]> = []
  Object.entries(input).slice(0, 30).forEach(([key, value]) => {
    if (!/^[a-zA-Z0-9_]{1,60}$/.test(key) || /prompt|manuscript|content|text|body|source_text/i.test(key)) return []
    if (typeof value === 'string') entries.push([key, value.slice(0, 240)])
    else if (typeof value === 'number' && Number.isFinite(value)) entries.push([key, value])
    else if (typeof value === 'boolean') entries.push([key, value])
  })
  return Object.fromEntries(entries)
}
