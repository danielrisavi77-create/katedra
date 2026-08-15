import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const scriptPath = resolve(process.cwd(), 'scripts/hybrid-mentor-ui-e2e.mjs')
const source = existsSync(scriptPath) ? readFileSync(scriptPath, 'utf8') : ''

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
    expect(source).toContain('BLOCKED_EXTERNAL')
    expect(source).toContain('KATEDRA_AUTH_E2E_EMAIL')
    expect(source).toContain('KATEDRA_AUTH_E2E_PASSWORD')
    expect(source).not.toContain('KATEDRA_AGENT_MODEL=')
  })
})
