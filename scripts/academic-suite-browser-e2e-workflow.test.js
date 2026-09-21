import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/academic-suite-browser-e2e.yml'), 'utf8')

describe('browser E2E release workflow', () => {
  it('uses the Playwright version installed by npm ci', () => {
    expect(workflow).toContain('npx playwright install --with-deps chromium')
    expect(workflow).not.toContain('npm install --no-save --package-lock=false playwright@')
    expect(workflow).not.toContain('playwright@1.55.0')
  })

  it('passes the canonical non-secret agentic contracts to the manual gate', () => {
    expect(workflow).toContain("KATEDRA_BILLING_RPC_CONTRACT: 'v2'")
    expect(workflow).toContain("KATEDRA_RATE_LIMIT_STORE: 'supabase'")
  })

  it('does not run the external Lekta browser gate without its preview URL', () => {
    expect(workflow).toContain("if: ${{ env.LEKTA_PREVIEW_URL != '' }}")
  })
})
