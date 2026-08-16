import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('rejects a webhook without a signature before initializing Stripe', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/webhook/route.js'), 'utf8')
  const signatureGuard = source.indexOf("if (!sig) return new Response('no signature', { status: 400 })")
  const stripeInitialization = source.indexOf('const stripe = getStripe()')

  expect(signatureGuard).toBeGreaterThan(-1)
  expect(stripeInitialization).toBeGreaterThan(-1)
  expect(signatureGuard).toBeLessThan(stripeInitialization)
})
