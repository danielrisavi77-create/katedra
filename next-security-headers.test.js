import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('defines production transport and browser isolation headers', () => {
  const source = readFileSync(resolve(process.cwd(), 'next.config.mjs'), 'utf8')

  expect(source).toContain('Strict-Transport-Security')
  expect(source).toContain('Permissions-Policy')
  expect(source).toContain('X-Frame-Options')
})

it('allows both local loopback development origins', () => {
  const source = readFileSync(resolve(process.cwd(), 'next.config.mjs'), 'utf8')

  expect(source).toContain("allowedDevOrigins: ['localhost', '127.0.0.1']")
})
