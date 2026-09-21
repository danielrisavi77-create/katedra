import { expect, it, vi } from 'vitest'
import { hasSnapshotConsent, recordSnapshotConsent } from './snapshot-consent'

it('requires an explicit boolean and the current consent version', () => {
  for (const value of [undefined, null, {}, true, { accepted: 'true', version: 'agentic-snapshot-v1' }, { accepted: false, version: 'agentic-snapshot-v1' }, { accepted: true, version: 'old' }]) {
    expect(hasSnapshotConsent(value)).toBe(false)
  }
  expect(hasSnapshotConsent({ accepted: true, version: 'agentic-snapshot-v1' })).toBe(true)
})

it('records consent with server time and the authenticated scope', async () => {
  const rpc = vi.fn().mockResolvedValue({ error: null })
  const scope = { userId: 'u', projectId: 'p', runId: 'r' }
  expect(await recordSnapshotConsent({ rpc }, scope, () => new Date('2026-09-08T12:00:00Z'))).toBe(true)
  expect(rpc).toHaveBeenCalledWith('record_agent_run_snapshot_consent', {
    p_user_id: 'u', p_project_id: 'p', p_run_id: 'r',
    p_consent_version: 'agentic-snapshot-v1', p_consent_at: '2026-09-08T12:00:00.000Z',
  })
})

it('fails closed on a rejected or unavailable consent write', async () => {
  const scope = { userId: 'u', projectId: 'p', runId: 'r' }
  expect(await recordSnapshotConsent({ rpc: vi.fn().mockResolvedValue({ error: { message: 'denied' } }) }, scope)).toBe(false)
  expect(await recordSnapshotConsent({ rpc: vi.fn().mockRejectedValue(new Error('offline')) }, scope)).toBe(false)
})
