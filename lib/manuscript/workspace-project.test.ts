import { describe, expect, it } from 'vitest'

import { selectWorkspaceProject } from './workspace-project'

describe('workspace project selection', () => {
  it('uses an explicitly requested project instead of the current global manifest', () => {
    expect(selectWorkspaceProject({
      requestedProjectId: 'project-b',
      localManifest: { projectId: 'project-a', topic: 'Rad A' },
      fallbackProjectId: 'project-a',
    })).toEqual({
      projectId: 'project-b',
      manifest: { projectId: 'project-b' },
      useLegacyState: false,
    })
  })

  it('keeps the current manifest and legacy state when no project was requested', () => {
    const manifest = { projectId: 'project-a', topic: 'Rad A' }

    expect(selectWorkspaceProject({
      requestedProjectId: '',
      localManifest: manifest,
      fallbackProjectId: 'project-a',
    })).toEqual({ projectId: 'project-a', manifest, useLegacyState: true })
  })

  it('does not discard local metadata when the requested project is the active one', () => {
    const manifest = { projectId: 'project-a', topic: 'Rad A' }

    expect(selectWorkspaceProject({
      requestedProjectId: 'project-a',
      localManifest: manifest,
      fallbackProjectId: 'project-a',
    })).toEqual({ projectId: 'project-a', manifest, useLegacyState: true })
  })
})
