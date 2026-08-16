import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('validates paid session amount, currency, token metadata, and canonical project IDs', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/webhook/route.js'), 'utf8')

  expect(source).toContain("s.currency !== 'eur'")
  expect(source).toContain('s.amount_total')
  expect(source).toContain('pkg.tokens')
  expect(source).toContain('s.metadata?.product_id !== pkg.productId')
  expect(source).toContain('project.work_type_canonical !== pkg.workType')
  expect(source).toContain('UUID_RE.test(projectId)')
  expect(source).toContain(".eq('academic_project_id', projectId)")
  expect(source).toContain('duplicate_project_pass')
})
