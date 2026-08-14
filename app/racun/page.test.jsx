import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('sends one stable reference ID for each withdrawal confirmation attempt', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/racun/page.jsx'), 'utf8')

  expect(source).toContain('createWithdrawalReference')
  expect(source).toContain('referenceId')
  expect(source).toContain('JSON.stringify({ reason: reason || undefined, referenceId })')
})

it('exposes withdrawal status and errors to assistive technology', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/racun/page.jsx'), 'utf8')

  expect(source).toContain('role="alert"')
  expect(source).toContain('aria-live="polite"')
  expect(source).toContain('htmlFor="withdrawal-reason"')
})
