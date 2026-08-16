import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'app/prijava/page.jsx'), 'utf8')

it('uses the shared Katedra auth shell without changing login behavior', () => {
  expect(source).toContain('auth-page')
  expect(source).toContain('auth-brand')
  expect(source).toContain('data-skin="kreda"')
  expect(source).toContain('Od teme do obrane')
  expect(source).not.toContain('Od teme do Katedre')
  expect(source).toContain('getSafeInternalRedirect')
  expect(source).toContain("fetch('/api/auth/login'")
  expect(source).toContain('window.location.assign(redirect)')
  expect(source).not.toContain('signInWithPassword')
})
