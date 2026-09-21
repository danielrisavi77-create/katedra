import { describe, expect, it, vi } from 'vitest'

import { cleanupExpiredAgentPayloads } from './payload-cleanup'

describe('temporary agent payload cleanup', () => {
  it('deletes private objects before finalizing expired manifests', async () => {
    const events: string[] = []
    const store = {
      listExpired: vi.fn(async () => [{ manifestId: 'm-1', bucket: 'bucket', storagePath: 'raw', manifestPath: 'manifest' }]),
      remove: vi.fn(async () => { events.push('remove'); return { ok: true as const } }),
      finalize: vi.fn(async () => { events.push('finalize'); return { ok: true as const, deleted: 1 } }),
    }

    await expect(cleanupExpiredAgentPayloads(store, '2026-08-14T10:00:00.000Z')).resolves.toMatchObject({ ok: true, deleted: 1 })
    expect(events).toEqual(['remove', 'finalize'])
  })

  it('does not finalize when a storage deletion fails, so a later retry can recover it', async () => {
    const finalize = vi.fn()
    const store = {
      listExpired: async () => [{ manifestId: 'm-1', bucket: 'bucket', storagePath: 'raw', manifestPath: 'manifest' }],
      remove: async () => ({ ok: false as const, error: 'storage unavailable' }),
      finalize,
    }

    await expect(cleanupExpiredAgentPayloads(store, '2026-08-14T10:00:00.000Z')).resolves.toMatchObject({ ok: false, deleted: 0 })
    expect(finalize).not.toHaveBeenCalled()
  })

  it('treats an already empty expiry set as a successful no-op', async () => {
    const finalize = vi.fn(async () => ({ ok: true as const, deleted: 0 }))
    const store = { listExpired: async () => [], remove: vi.fn(), finalize }

    await expect(cleanupExpiredAgentPayloads(store, '2026-08-14T10:00:00.000Z')).resolves.toEqual({ ok: true, deleted: 0 })
    expect(finalize).not.toHaveBeenCalled()
  })
})
