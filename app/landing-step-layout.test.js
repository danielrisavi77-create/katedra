import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('centers landing step markers above each step copy', () => {
  const css = readFileSync(resolve(process.cwd(), 'app/katedra-scoped.css'), 'utf8')

  expect(css).toMatch(/\.katedra-page\.landing-page \.landing-step-grid > div\{[^}]*text-align:center;/)
  expect(css).toContain('.katedra-page.landing-page .landing-step-grid > div > div:first-child{')
  expect(css).toContain('margin:0 auto 12px!important')
})
