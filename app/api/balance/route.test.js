import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('uses the canonical Project Pass repository instead of the removed entitlement columns', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/balance/route.js'), 'utf8')

  expect(source).toContain("const db = createAdminClient()")
  expect(source).toContain("lookupActiveProjectPass(db, { userId: user.id, projectId: project.projectId })")
  expect(source).toContain("resolveOwnedProject(db, { userId: user.id, projectId })")
  expect(source).not.toContain(".eq('project_id', projectId)")
  expect(source).not.toContain(".in('scope', PASS_SCOPES)")
  expect(source).toContain('wallet_lookup_failed')
  expect(source).toContain('authorizeProjectAiRequest')
})
