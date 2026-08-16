import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('keeps landing motion progressively enhanced and accessible', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/landing-motion.jsx'), 'utf8')

  expect(source).toContain('IntersectionObserver')
  expect(source).toContain('prefers-reduced-motion')
  expect(source).toContain('data-motion-ready')
  expect(source).toContain('data-revealed')
  expect(source).toContain('IntersectionObserver unavailable')
  expect(source).toContain('pointermove')
  expect(source).toContain('--paper-shift-x')
  expect(source).toContain('data-parallax-ready')
})
