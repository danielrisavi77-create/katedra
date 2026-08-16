import { describe, expect, it } from 'vitest'

import { createManuscript } from './model'
import { validateStoredManuscript } from './runtime-validation'

describe('stored manuscript validation', () => {
  it('accepts a valid manuscript for the requested project', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })

    expect(validateStoredManuscript(manuscript, 'project-1')).toEqual(manuscript)
  })

  it('rejects malformed or cross-project stored values', () => {
    const manuscript = createManuscript({ projectId: 'project-1', workType: 'z' })

    expect(validateStoredManuscript({ ...manuscript, sections: null }, 'project-1')).toBeNull()
    expect(validateStoredManuscript(manuscript, 'project-2')).toBeNull()
  })
})
