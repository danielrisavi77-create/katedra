import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'app/pisi/pisi.css'), 'utf8')
const shell = readFileSync(resolve(process.cwd(), 'app/pisi/components/workspace-shell.tsx'), 'utf8')
const navigation = readFileSync(resolve(process.cwd(), 'app/pisi/components/workspace-navigation.tsx'), 'utf8')
const passDialog = readFileSync(resolve(process.cwd(), 'app/pisi/components/pass-dialog.tsx'), 'utf8')

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
  expect(css).toContain('.pis-mobile-overflow')
  expect(css).toContain('env(safe-area-inset-bottom)')
  expect(css).toContain('.pis-topbar button:focus-visible')
  expect(css).toContain('.pis-mobile-nav button:focus-visible')
  expect(css).toContain("html[data-theme='dark'] .pis-overflow-menu")
  expect(css).toContain("html[data-theme='dark'] .pis-export-button")
})

it('defines the quiet manuscript composition contract', () => {
  expect(css).toContain('.pis-section-heading')
  expect(css).toContain('.pis-formatbar')
  expect(css).toContain('top: 0')
  expect(css).toContain('.pis-save-state .pis-save-label')
})

it('constrains the desktop action zone so account controls cannot overflow', () => {
  expect(css).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr)')
  expect(css).toContain('.pis-desktop-account { min-width: 0; max-width: clamp(150px, 18vw, 260px); overflow: hidden; }')
  expect(css).toContain('.pis-desktop-account .pis-account { min-width: 0; display: block; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }')
  expect(css).toContain('.pis-account-group .pis-pass-status { flex: 0 0 auto; }')
})

it('defines the paid project lock confirmation surface', () => {
  expect(passDialog).toContain('lockConfirmation: true')
  expect(passDialog).toContain('pis-pass-warning')
  expect(css).toContain('.pis-pass-summary')
  expect(css).toContain('.pis-pass-warning')
  expect(css).toContain("html[data-theme='dark'] .pis-pass-warning")
})

it('defines phase-aware agentic workspace surfaces', () => {
  expect(shell).toContain('data-workspace-view={view}')
  expect(navigation).toContain('pis-phase-state')
  expect(css).toContain('.pis-agentic-dashboard-grid')
  expect(css).toContain('.pis-intervention-grid')
  expect(css).toContain('.pis-review-actions')
  expect(css).toContain("html[data-theme='dark'] .pis-phase-state b")
})

it('defines the hybrid workspace surface and navigation tokens', () => {
  expect(css).toContain('--pis-workspace-nav-width')
  expect(css).toContain('--pis-content-max')
  expect(css).toContain('.pis-project-nav')
  expect(css).toContain("html[data-theme='dark'] .pis-project-nav")
})

it('keeps reduced motion and visible focus contracts on the new primitives', () => {
  expect(css).toContain('.pis-primary-button:focus-visible')
  expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  expect(css).toContain('.pis-project-nav')
})
