import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('supports an explicit projectId for exact state reads', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/state/route.js'), 'utf8')

  expect(source).toContain("new URL(req.url).searchParams.get('projectId')")
  expect(source).toContain(".eq('project_id', project.projectId)")
})

it('does not persist free-form log or history text in the shared state path', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/state/route.js'), 'utf8')

  expect(source).not.toContain("txt: typeof e?.txt")
  expect(source).not.toContain("label: typeof e?.label")
})

it('enforces the canonical project lock when the lock contract is enabled', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/state/route.js'), 'utf8')

  expect(source).toContain('KATEDRA_PROJECT_LOCKS_ENABLED')
  expect(source).toContain('readProjectLock')
  expect(source).toContain('validateLockedProjectMutation')
})
