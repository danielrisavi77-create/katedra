import { describe, expect, it, vi } from 'vitest'

import { CLIENT_KATEDRA_PRODUCT_EVENTS, KATEDRA_PRODUCT_EVENTS, recordKatedraProductEvent, sanitizeProperties } from './product-events'

describe('Katedra product analytics', () => {
  it('removes manuscript-like properties', () => {
    expect(sanitizeProperties({ action: 'write', manuscript: 'secret', prompt: 'secret', count: 2 })).toEqual({ action: 'write', count: 2 })
  })

  it('keeps payment, worker, Lekta and completion events out of the browser allowlist', () => {
    expect(KATEDRA_PRODUCT_EVENTS).toEqual(expect.arrayContaining([
      'purchase_completed', 'agent_run_completed', 'lekta_recheck_completed', 'project_completed',
    ]))
    expect(CLIENT_KATEDRA_PRODUCT_EVENTS).not.toEqual(expect.arrayContaining([
      'purchase_completed', 'agent_run_completed', 'lekta_recheck_completed', 'project_completed',
    ]))
  })

  it('is idempotent and does not break the product flow on sink errors', async () => {
    const insert = vi.fn().mockResolvedValueOnce({ error: { code: '23505' } }).mockRejectedValueOnce(new Error('offline'))
    const db = { from: vi.fn(() => ({ insert })) }
    expect(await recordKatedraProductEvent(db, { eventName: 'project_completed', projectId: '00000000-0000-4000-8000-000000000001', idempotencyKey: 'done-1' })).toEqual({ ok: true, duplicate: true })
    expect((await recordKatedraProductEvent(db, { eventName: 'project_completed' })).ok).toBe(false)
  })
})
