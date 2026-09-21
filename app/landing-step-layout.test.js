import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('centers landing step markers above each step copy', () => {
  const css = readFileSync(resolve(process.cwd(), 'app/katedra-scoped.css'), 'utf8')

  expect(css).toMatch(/\.katedra-page\.landing-page \.landing-step-grid > div\{[^}]*text-align:center;/)
  expect(css).toContain('.katedra-page.landing-page .landing-step-grid > div > div:first-child{')
  expect(css).toContain('margin:0 auto 12px!important')
})

it('describes the real guided onboarding instead of promising a chat step', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/page.jsx'), 'utf8')

  expect(source).toContain('Odgovori na nekoliko pitanja o radu:')
  expect(source).not.toContain('Odgovori na par pitanja u chatu:')
})
