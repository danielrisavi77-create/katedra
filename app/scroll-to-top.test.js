import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('provides one accessible global scroll-to-top control', () => {
  const componentPath = resolve(process.cwd(), 'app/scroll-to-top.jsx')
  expect(existsSync(componentPath)).toBe(true)

  if (!existsSync(componentPath)) return

  const component = readFileSync(componentPath, 'utf8')
  const layout = readFileSync(resolve(process.cwd(), 'app/layout.jsx'), 'utf8')
  const globals = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

  expect(component).toContain('window.scrollY')
  expect(component).toContain('window.scrollTo')
  expect(component).toContain('prefers-reduced-motion')
  expect(component).toContain('aria-label="Vrati se na vrh"')
  expect(layout).toContain('ScrollToTop')
  expect(layout).toContain('data-scroll-behavior="smooth"')
  expect(globals).toContain('.global-scroll-top')
})
