import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('keeps temporary material uploads behind the project and private storage contracts', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/materials/route.js'), 'utf8')

  expect(source).toContain('KATEDRA_MATERIALS_ENABLED')
  expect(source).toContain('readProjectLock')
  expect(source).toContain('.storage.from')
  expect(source).toContain('asset')
  expect(source).toContain('manifest')
  expect(source).toContain('expiresAt')
})
