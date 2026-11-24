'use client'

import type { ClientKatedraProductEventName } from './product-events'

const ANONYMOUS_ID_KEY = 'katedra_product_analytics_anonymous_id'

export function recordClientProductEvent(input: { eventName: ClientKatedraProductEventName; projectId?: string; properties?: Record<string, unknown>; idempotencyKey?: string }): void {
  const anonymousId = getClientAnonymousId()
  void fetch('/api/analytics/product', { method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true, body: JSON.stringify({ ...input, anonymousId }) }).catch(() => undefined)
}

export function getClientAnonymousId(): string {
  try {
    const existing = localStorage.getItem(ANONYMOUS_ID_KEY)
    if (existing) return existing
    const created = globalThis.crypto?.randomUUID?.() || `anon-${Date.now().toString(36)}`
    localStorage.setItem(ANONYMOUS_ID_KEY, created)
    return created
  } catch { return 'anonymous-session' }
}
