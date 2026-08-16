import { describe, expect, it } from 'vitest'

import { isScopedAgentPayload } from './payload-scope'

const scope = { userId: 'user-1', projectId: 'project-1', runId: 'run-1', bucket: 'bucket' }

function entry(overrides: Record<string, unknown> = {}) {
  return {
    materialId: 'material-1',
    projectId: 'project-1',
    runId: 'run-1',
    storageBucket: 'bucket',
    storagePath: 'user-1/project-1/material-1-file.txt',
    manifestPath: 'user-1/project-1/material-1.manifest.json',
    ...overrides,
  }
}

describe('agent payload storage scope', () => {
  it('accepts a payload inside the user and project namespace', () => {
    expect(isScopedAgentPayload(entry(), scope)).toBe(true)
  })

  it.each([
    { storagePath: 'user-2/project-1/file.txt' },
    { manifestPath: 'user-1/project-2/file.json' },
    { storagePath: 'user-1/project-1/../other/file.txt' },
    { storagePath: 'user-1/project-1\\other\\file.txt' },
    { storageBucket: 'public' },
    { runId: 'other-run' },
  ])('rejects an out-of-scope payload: %o', (overrides) => {
    expect(isScopedAgentPayload(entry(overrides), scope)).toBe(false)
  })
})
