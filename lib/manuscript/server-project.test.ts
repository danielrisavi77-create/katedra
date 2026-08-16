import { describe, expect, it } from 'vitest'

import { serverStateToManifest } from './server-project'

describe('server project metadata hydration', () => {
  it('reconstructs a local manifest from canonical state without document text', () => {
    expect(serverStateToManifest('project-1', {
      projectId: 'project-1',
      topic: '  Tema rada  ',
      workTypeCanonical: 'final',
      deadline: '2026-12-01',
      unitId: 'fpzg',
      profileId: 'politologija',
      manuscript: 'ne smije se koristiti',
    })).toEqual({
      projectId: 'project-1',
      topic: 'Tema rada',
      workType: 'z',
      deadline: '2026-12-01',
      unitId: 'fpzg',
      profileId: 'politologija',
    })
  })

  it('fails closed when the server does not have a usable project identity', () => {
    expect(serverStateToManifest('project-1', { topic: '', workType: 'z' })).toBeNull()
    expect(serverStateToManifest('project-1', { topic: 'Tema', workType: 'unknown' })).toBeNull()
    expect(serverStateToManifest('', { topic: 'Tema', workType: 'z' })).toBeNull()
  })
})
