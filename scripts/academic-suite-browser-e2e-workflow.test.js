import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REQUIRED_AGENTIC_STAGING_ENV } from '../lib/deployment/agentic-preflight.mjs'

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/academic-suite-browser-e2e.yml'), 'utf8')

describe('browser E2E release workflow', () => {
  it('wires every required setting to the manual preflight without exposing provider keys to PR jobs', () => {
    const jobEnvironment = workflow.split(/    env:\r?\n/)[1].split('    steps:')[0]
    const manualStep = workflow.match(/      - name: Require agentic staging worker configuration[\s\S]*?(?=\r?\n      - name:)/)?.[0] || ''
    const configured = new Set([...`${jobEnvironment}\n${manualStep}`.matchAll(/^\s{6,10}([A-Z][A-Z0-9_]+):/gm)].map(match => match[1]))
    expect(REQUIRED_AGENTIC_STAGING_ENV.filter(key => !configured.has(key))).toEqual([])
    expect(manualStep).toContain("if: ${{ github.event_name == 'workflow_dispatch' }}")
    expect(jobEnvironment).not.toContain('ANTHROPIC_API_KEY')
    expect(jobEnvironment).not.toContain('KATEDRA_VERIFIER_PROVIDER_KEY')
  })
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
