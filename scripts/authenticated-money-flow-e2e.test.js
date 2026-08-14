import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('keeps authenticated E2E credentials external and fails closed when absent', () => {
  const source = readFileSync(resolve(process.cwd(), 'scripts/authenticated-money-flow-e2e.mjs'), 'utf8')

  expect(source).toContain('KATEDRA_AUTH_E2E_EMAIL')
  expect(source).toContain('KATEDRA_AUTH_E2E_PASSWORD')
  expect(source).toContain('if (!EMAIL || !PASSWORD)')
  expect(source).toContain("response.headers()['x-request-id']")
  expect(source.indexOf('await completeStripeTestCheckout()')).toBeLessThan(source.indexOf("const draftAction = page.getByRole('button'"))
  expect(source).not.toContain('console.log(EMAIL)')
  expect(source).not.toContain('console.log(PASSWORD)')
})
