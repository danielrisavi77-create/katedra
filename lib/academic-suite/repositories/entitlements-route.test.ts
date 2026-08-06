import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('keeps the chat route behind the typed Project Pass repository', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/chat/route.js'), 'utf8')

  expect(source).toContain("import { hasActiveProjectPass } from '@/lib/academic-suite/repositories/entitlements'")
  expect(source).toContain('hasPass = await hasActiveProjectPass(db, { userId, projectId })')
  expect(source).not.toContain(".from('entitlements')")
  expect(source).not.toContain('PASS_SCOPES')
})
