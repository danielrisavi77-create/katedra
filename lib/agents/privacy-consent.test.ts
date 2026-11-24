import { describe, expect, it } from 'vitest'

import {
  AGENT_SNAPSHOT_CONSENT_VERSION,
  createAgentSnapshotConsent,
  validateAgentSnapshotConsent,
} from './privacy-consent'

describe('agent snapshot privacy consent', () => {
  const now = Date.parse('2026-08-22T10:00:00.000Z')

  it('accepts an explicit, current consent for the exact project', () => {
    const consent = createAgentSnapshotConsent('project-1', now)

    expect(consent).toEqual({
      version: AGENT_SNAPSHOT_CONSENT_VERSION,
      projectId: 'project-1',
      acceptedAt: '2026-08-22T10:00:00.000Z',
    })
    expect(validateAgentSnapshotConsent(consent, 'project-1', now)).toEqual({ ok: true, value: consent })
  })

  it('rejects missing, foreign-project, stale and future consent', () => {
    expect(validateAgentSnapshotConsent(undefined, 'project-1', now).ok).toBe(false)
    expect(validateAgentSnapshotConsent({ version: AGENT_SNAPSHOT_CONSENT_VERSION, projectId: 'project-2', acceptedAt: new Date(now).toISOString() }, 'project-1', now).ok).toBe(false)
    expect(validateAgentSnapshotConsent({ version: AGENT_SNAPSHOT_CONSENT_VERSION, projectId: 'project-1', acceptedAt: '2025-01-01T00:00:00.000Z' }, 'project-1', now).ok).toBe(false)
    expect(validateAgentSnapshotConsent({ version: AGENT_SNAPSHOT_CONSENT_VERSION, projectId: 'project-1', acceptedAt: '2026-08-22T10:10:00.000Z' }, 'project-1', now).ok).toBe(false)
  })
})
