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

it('defines project navigation alongside the existing agentic workspace surfaces', () => {
  expect(shell).toContain('data-workspace-view={view}')
  expect(shell).toContain('ProjectNavigation')
  expect(navigation).toContain('Dodatne radnje')
  expect(css).toContain('.pis-agentic-dashboard-grid')
  expect(css).toContain('.pis-intervention-grid')
  expect(css).toContain('.pis-review-actions')
  expect(css).toContain("html[data-theme='dark'] .pis-project-nav")
})

it('defines the hybrid workspace surface and navigation tokens', () => {
  expect(css).toContain('--pis-workspace-nav-width')
  expect(css).toContain('--pis-content-max')
  expect(css).toContain('.pis-project-nav')
  expect(css).toContain("html[data-theme='dark'] .pis-project-nav")
})

it('keeps the mobile project home independently scrollable above the safe area', () => {
  expect(css).toMatch(/@media \(max-width: 900px\) \{[\s\S]*?\.pis-project-home-main \{[^}]*height: calc\(100vh - 112px - env\(safe-area-inset-bottom\)\);[^}]*max-height: calc\(100vh - 112px - env\(safe-area-inset-bottom\)\);[^}]*overflow-y: auto;[^}]*padding: 32px 20px calc\(90px \+ env\(safe-area-inset-bottom\)\);/)
})

it('defines exact light and dark values for the mentor workspace tokens', () => {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  const dark = css.match(/html\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  const lightTokens = {
    '--pis-bg': '#e9e1cf',
    '--pis-paper': '#fbf8f0',
    '--pis-paper-deep': '#f3eddf',
    '--pis-ink': '#22252e',
    '--pis-muted': '#5a574f',
    '--pis-line': 'rgba(34, 37, 46, 0.16)',
    '--pis-line-strong': 'rgba(34, 37, 46, 0.28)',
    '--pis-blue': '#2c5fa8',
    '--pis-blue-dark': '#173d78',
    '--pis-yellow': '#f2c94c',
  }
  const darkTokens = {
    '--pis-bg': '#18232a',
    '--pis-paper': '#27363e',
    '--pis-paper-deep': '#202d34',
    '--pis-ink': '#f5eddd',
    '--pis-muted': '#c1b9aa',
    '--pis-line': 'rgba(245, 237, 221, .15)',
    '--pis-line-strong': 'rgba(245, 237, 221, .3)',
    '--pis-blue': '#78a8eb',
    '--pis-blue-dark': '#b9d4ff',
    '--pis-yellow': '#f4cf62',
  }

  for (const [token, value] of Object.entries(lightTokens)) expect(root).toContain(`${token}: ${value}`)
  for (const [token, value] of Object.entries(darkTokens)) expect(dark).toContain(`${token}: ${value}`)
})

it('keeps exact focus, radius, content-width, and reduced-motion contracts', () => {
  expect(css).toMatch(/\.pis-primary-button:focus-visible,[\s\S]*?box-shadow:\s*var\(--pis-focus-ring\)/)
  expect(css).toMatch(/\.pis-surface\s*\{[^}]*border-radius:\s*2px/)
  expect(css).toMatch(/\.pis-primary-button,[\s\S]*?border-radius:\s*2px/)
  expect(css).toContain('.pis-project-home { width: min(var(--pis-content-max), 100%);')
  expect(css.match(/html\[data-theme='dark'\] \.pis-project-nav/g)).toHaveLength(1)

  const reducedMotion = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\n\}/)?.[1] ?? ''
  expect(reducedMotion).toMatch(/\.pis-primary-button,\s*\.pis-secondary-button,\s*\.pis-project-nav button,/)
  expect(reducedMotion).toMatch(/\.pis-writing-frame,\s*\.pis-assistant\s*\{\s*transition:\s*none;\s*animation:\s*none;\s*\}/)
})
