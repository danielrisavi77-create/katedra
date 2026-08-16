import { describe, expect, it } from 'vitest'

import { stripManuscriptFromStatePayload } from './privacy'

describe('manuscript privacy boundary', () => {
  it('removes document content even when full sync consent is true', () => {
    const payload = stripManuscriptFromStatePayload({
      projectId: 'project-1',
      fullSyncConsent: true,
      manuscript: { sections: [{ content: 'tajni tekst' }] },
      gen: {
        f_fakultet: 'FPZG',
        manuscript: { sections: [{ content: 'tajni tekst' }] },
      },
    })

    expect(payload).toEqual({
      projectId: 'project-1',
      fullSyncConsent: true,
      gen: { f_fakultet: 'FPZG' },
    })
  })
})
