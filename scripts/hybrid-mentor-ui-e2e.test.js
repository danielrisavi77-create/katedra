import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const scriptPath = resolve(process.cwd(), 'scripts/hybrid-mentor-ui-e2e.mjs')
const source = existsSync(scriptPath) ? readFileSync(scriptPath, 'utf8') : ''
const freePlanSource = readFileSync(resolve(process.cwd(), 'app/pisi/components/free-project-plan.tsx'), 'utf8')
const legacySource = readFileSync(resolve(process.cwd(), 'scripts/agentic-workspace-ui-e2e.mjs'), 'utf8')
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))

describe('hybrid mentor workspace browser contract', () => {
  it('covers the public route, theme and viewport matrix', () => {
    expect(source).toContain("const routes = ['/', '/pisi', '/racun', '/prijava', '/registracija', '/privatnost', '/uvjeti']")
    expect(source).toContain("const themes = ['light', 'dark']")
    expect(source).toContain('const widths = [390, 768, 1440]')
  })

  it('asserts the shared page and project-workspace contracts', () => {
    expect(source).toContain("page.locator('main')")
    expect(source).toContain("page.locator('h1')")
    expect(source).toContain('scrollWidth')
    expect(source).toContain("page.on('pageerror'")
    expect(source).toContain('Početna')
    expect(source).toContain('Literatura')
    expect(source).toContain('Pisanje')
    expect(source).toContain('Revizija')
    expect(source).toContain('Provjera u Lekti')
  })

  it('keeps local UI checks separate from authenticated external gates', () => {
    expect(source).toContain("process.env.KATEDRA_INTEGRATION_URL || 'http://localhost:3000'")
    expect(source).toContain("from '../lib/deployment/agentic-preflight.mjs'")
    expect(source).toContain('evaluateAgenticStagingEnvironment')
    expect(source).toContain('BLOCKED_EXTERNAL')
    expect(source).toContain('KATEDRA_AUTH_E2E_EMAIL')
    expect(source).toContain('KATEDRA_AUTH_E2E_PASSWORD')
    expect(source).not.toContain('KATEDRA_AGENT_MODEL=')
  })

  it('proves the guest journey state, scan, home and writing surfaces', () => {
    expect(source).toContain("getAttribute('class')")
    expect(source).toContain('inputValue()')
    expect(source).toContain('Već imaš')
    expect(source).toContain('Nedostaje')
    expect(source).toContain('Sljedeća tri koraka')
    expect(source).toContain('nextSteps')
    expect(source).toContain('data-primary-action="true"')
    expect(source).toContain("page.locator('.pis-prosemirror')")
    expect(source).toContain('Fakultet političkih znanosti')
    expect(source).toContain('Politologija')
  })

  it('checks writing landmarks and meaningful dark-mode computed styles', () => {
    expect(source).toContain('Struktura rada')
    expect(source).toContain('Katedra urednik')
    expect(source).toContain('getComputedStyle')
    expect(source).toContain('contrastRatio')
    expect(source).toContain('backgroundColor')
    expect(source).toContain('color')
  })

  it('keeps mobile and desktop workspace assertions at their supported breakpoints', () => {
    expect(source).toContain('width < 901')
    expect(source).toContain("page.locator('.pis-prosemirror:visible')")
    expect(source).toContain("mobileNav.locator('[aria-current=\"page\"]')")
    expect(source).toContain('width >= 901')
    expect(source).toContain("page.getByRole('navigation', { name: 'Struktura rada' })")
    expect(source).toContain("page.getByRole('complementary', { name: 'Katedra urednik' })")
  })

  it('uses the explicit primary-action contract on Completion Scan and home', () => {
    expect(freePlanSource).toContain('data-primary-action="true"')
    expect(source).toContain("scan.locator('[data-primary-action=\"true\"]')")
    expect(source).toContain("page.locator('[data-primary-action=\"true\"]')")
    expect(source).not.toContain('scan.locator(\'.pis-primary-button\')')
  })

  it('exposes a runtime npm command and keeps the legacy agentic gate truthful', () => {
    expect(packageJson.scripts?.['test:e2e:hybrid-ui']).toBe('node scripts/hybrid-mentor-ui-e2e.mjs')
    expect(legacySource).toContain("from '../lib/deployment/agentic-preflight.mjs'")
    expect(legacySource).not.toContain('function evaluateAgenticStagingEnvironment')
    expect(legacySource).toContain('evaluateAgenticStagingEnvironment')
    expect(legacySource).toContain('AGENTIC_WORKSPACE_UI_STAGING_E2E_PASS')
    expect(legacySource).not.toContain('AGENTIC_WORKSPACE_UI_BROWSER_E2E_PASS')
  })
})
