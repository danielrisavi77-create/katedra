import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'app/pisi/pisi.css'), 'utf8')
const shell = readFileSync(resolve(process.cwd(), 'app/pisi/components/workspace-shell.tsx'), 'utf8')
const navigation = readFileSync(resolve(process.cwd(), 'app/pisi/components/workspace-navigation.tsx'), 'utf8')

it('defines explicit dark-mode contrast for interactive manuscript surfaces', () => {
  expect(css).toContain("html[data-theme='dark'] .pis-proposal textarea")
  expect(css).toContain("html[data-theme='dark'] .pis-section-controls select")
  expect(css).toContain("html[data-theme='dark'] .pis-save-state[data-state='saved']")
})

it('announces save and metadata sync changes to assistive technology', () => {
  expect(`${shell}\n${navigation}`).toContain('aria-live="polite"')
  expect(`${shell}\n${navigation}`).toContain('role="status"')
})

it('keeps nonessential motion disabled for reduced-motion users', () => {
  expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  expect(css).toContain('.pis-drawer-backdrop')
  expect(css).toContain('.pis-proposal')
})

it('defines the editorial desktop and mobile navigation contract', () => {
  expect(css).toContain('.pis-workspace-nav-context')
  expect(css).toContain('.pis-mobile-overflow')
  expect(css).toContain('env(safe-area-inset-bottom)')
  expect(css).toContain('.pis-topbar button:focus-visible')
  expect(css).toContain('.pis-mobile-nav button:focus-visible')
  expect(css).toContain("html[data-theme='dark'] .pis-overflow-menu")
  expect(css).toContain("html[data-theme='dark'] .pis-export-button")
})
