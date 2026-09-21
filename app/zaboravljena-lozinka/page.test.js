import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'app/zaboravljena-lozinka/page.jsx'), 'utf8')

it('uses the Katedra server-side password reset endpoint', () => {
  expect(source).toContain("fetch('/api/auth/password-reset'")
  expect(source).toContain('retryAt')
  expect(source).toContain('toLocaleTimeString')
  expect(source).not.toContain('resetPasswordForEmail')
  expect(source).not.toContain('window.location.origin')
})
