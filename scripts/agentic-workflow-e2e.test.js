import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('agenticni authenticated E2E koristi canonical staging preflight prije browsera', () => {
  const source = readFileSync(resolve(process.cwd(), 'scripts/agentic-workflow-e2e.mjs'), 'utf8')

  expect(source).toContain("from '../lib/deployment/agentic-preflight.mjs'")
  expect(source).toContain('evaluateAgenticStagingEnvironment(process.env)')
  expect(source).toContain('BLOCKED_EXTERNAL')
  expect(source).toContain('KATEDRA_E2E_REQUIRE_CONFIG')
})

it('ne proglašava stale intervention banner uspješnim nastavkom runa', () => {
  const source = readFileSync(resolve(process.cwd(), 'scripts/agentic-workflow-e2e.mjs'), 'utf8')

  expect(source).toContain("page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/resume') && response.status() === 200")
  expect(source).toContain('terminalText = await waitForTerminalRun()')
  expect(source).toContain("assert.match(terminalText, /Tijek je završen/i,")
})
