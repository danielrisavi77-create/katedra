import { describe, expect, it } from 'vitest'

import { MAX_AGENT_CONTEXT_BYTES, runContextStoragePaths, validateAgentRunContext } from './run-context'

const manuscript = {
  schemaVersion: 1,
  projectId: 'project-1',
  title: 'Seminarski rad',
  workType: 's',
  activeSectionId: 'intro',
  sections: [{
    id: 'intro',
    title: 'Uvod',
    kind: 'chapter',
    order: 0,
    status: 'draft',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Teza rada.' }] }] },
    updatedAt: '2026-08-14T10:00:00.000Z',
  }],
  sources: [],
  meta: {},
  createdAt: '2026-08-14T10:00:00.000Z',
  updatedAt: '2026-08-14T10:00:00.000Z',
}

describe('agent run context', () => {
  it('uses a stable private storage namespace for worker resume', () => {
    expect(runContextStoragePaths('user-1', 'project-1', 'run-1')).toEqual({
      storagePath: 'user-1/project-1/run-1/manuscript-context.json',
      manifestPath: 'user-1/project-1/run-1/manuscript-context.manifest.json',
    })
  })

  it('validates a manuscript snapshot and keeps the canonical project id', () => {
    const result = validateAgentRunContext({ manuscript }, 'project-1')

    expect(result).toEqual({ ok: true, manuscript })
  })

  it('rejects a snapshot belonging to another project', () => {
    const result = validateAgentRunContext({ manuscript }, 'project-2')

    expect(result).toMatchObject({ ok: false, reason: 'project_mismatch' })
  })

  it('rejects a body without a manuscript snapshot', () => {
    const result = validateAgentRunContext({ projectId: 'project-1' }, 'project-1')

    expect(result).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('rejects a context larger than the transport limit before storage', () => {
    const result = validateAgentRunContext({ manuscript: { ...manuscript, title: 'x'.repeat(MAX_AGENT_CONTEXT_BYTES) } }, 'project-1')

    expect(result).toMatchObject({ ok: false, reason: 'too_large' })
  })
})
