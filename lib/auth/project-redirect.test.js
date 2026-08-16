import { describe, expect, it } from 'vitest'

import { buildProjectAuthRedirect } from './project-redirect'

describe('buildProjectAuthRedirect', () => {
  it('keeps the canonical project id in the internal auth destination', () => {
    expect(buildProjectAuthRedirect('project-123')).toBe('/pisi?projectId=project-123')
  })

  it('encodes project ids without allowing an external redirect', () => {
    expect(buildProjectAuthRedirect('project id/with?unsafe')).toBe('/pisi?projectId=project+id%2Fwith%3Funsafe')
  })

  it('falls back to the workspace when the project id is missing', () => {
    expect(buildProjectAuthRedirect('')).toBe('/pisi')
  })
})
