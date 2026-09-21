import { describe, expect, it } from 'vitest'

import { GOLDEN_ACADEMIC_PROJECTS } from './golden-projects'
import { verifyAgentResult } from './verifier'

describe('Golden Academic Projects', () => {
  it('covers ten reproducible project and source-gate scenarios across all work types', () => {
    expect(GOLDEN_ACADEMIC_PROJECTS).toHaveLength(10)
    expect(new Set(GOLDEN_ACADEMIC_PROJECTS.map((project) => project.id)).size).toBe(10)
    expect(new Set(GOLDEN_ACADEMIC_PROJECTS.map((project) => project.workType))).toEqual(new Set(['s', 'z', 'd']))
    expect(new Set(GOLDEN_ACADEMIC_PROJECTS.map((project) => project.expectedVerification))).toEqual(new Set(['verified', 'needs_revision', 'blocked']))
  })

  it.each(GOLDEN_ACADEMIC_PROJECTS)('$id remains aligned with the verifier contract', (project) => {
    const verification = verifyAgentResult(project.result, { requireIndependentSourceVerification: true })
    expect(verification.status).toBe(project.expectedVerification)
  })
})
