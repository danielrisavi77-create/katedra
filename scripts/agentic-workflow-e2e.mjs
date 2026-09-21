import assert from 'node:assert/strict'
import { evaluateAgenticStagingEnvironment } from '../lib/deployment/agentic-preflight.mjs'

const KATEDRA_URL = String(process.env.KATEDRA_INTEGRATION_URL || '').replace(/\/$/, '')
const EMAIL = String(process.env.KATEDRA_AUTH_E2E_EMAIL || '')
const PASSWORD = String(process.env.KATEDRA_AUTH_E2E_PASSWORD || '')
const TIMEOUT_MS = Number(process.env.KATEDRA_AGENT_E2E_TIMEOUT_MS || 180_000)
const REQUIRE_EXTERNAL_CONFIG = process.env.KATEDRA_E2E_REQUIRE_CONFIG === '1'

const staging = evaluateAgenticStagingEnvironment(process.env)
const missingExternal = [
  ['KATEDRA_INTEGRATION_URL', KATEDRA_URL],
  ['KATEDRA_AUTH_E2E_EMAIL', EMAIL],
  ['KATEDRA_AUTH_E2E_PASSWORD', PASSWORD],
].filter(([, value]) => !value).map(([name]) => name)
const externalProblems = [...new Set([...missingExternal, ...staging.missing, ...staging.invalid])]
if (externalProblems.length) {
  console.log(`BLOCKED_EXTERNAL: authenticated agentic workflow is not run without canonical staging contracts: ${externalProblems.join(', ')}`)
  process.exit(REQUIRE_EXTERNAL_CONFIG ? 1 : 0)
}

const { chromium } = await import('playwright')
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()
const apiResponses = []
const runRequests = []
const browserErrors = []
page.on('pageerror', (error) => browserErrors.push(String(error)))
page.on('request', (request) => {
  if (new URL(request.url()).pathname !== '/api/agent-runs' || request.method() !== 'POST') return
  try {
    const body = JSON.parse(request.postData() || '{}')
    runRequests.push({ hasManuscript: Boolean(body.manuscript), sectionCount: Array.isArray(body.sectionIds) ? body.sectionIds.length : 0 })
  } catch {
    runRequests.push({ hasManuscript: false, sectionCount: 0 })
  }
})
page.on('response', (response) => {
  const pathname = new URL(response.url()).pathname
  if (pathname.startsWith('/api/agent-runs') || pathname === '/api/materials') {
    apiResponses.push({ pathname, status: response.status() })
  }
})

async function completeOnboarding() {
  const newWork = page.getByRole('button', { name: /Novi rad/i })
  if (!(await newWork.isVisible().catch(() => false))) return
  await newWork.click()
  await page.getByLabel(/Fakultet ili ustanova/i).fill('FPZG')
  await page.getByRole('button', { name: /Dalje/i }).click()
  await page.getByRole('button', { name: /Dalje/i }).click()
  await page.getByLabel(/Tema rada/i).fill('Agentic staging workflow')
  await page.getByRole('button', { name: /Dalje/i }).click()
  await page.getByRole('button', { name: /Otvori projekt/i }).click()
  await page.getByRole('button', { name: /Nastavi u projektu/i }).click()
  await page.getByRole('button', { name: /Nastavi pisati →/i }).click()
}

async function waitForTerminalRun() {
  const deadline = Date.now() + TIMEOUT_MS
  while (Date.now() < deadline) {
    const run = page.locator('.pis-agentic-dashboard')
    const text = await run.textContent().catch(() => '')
    if (/Tijek je otkazan/i.test(text || '')) throw new Error('Agent run je otkazan.')
    if (/Potrebna je intervencija|Tijek je završen|Tijek je zaustavljen/i.test(text || '')) return text || ''
    if (/Tijek je završen|Potrebna je tvoja odluka|Tijek je zaustavljen/i.test(text || '')) return text || ''
    await page.waitForTimeout(1000)
  }
  throw new Error(`Agent run nije završio unutar ${TIMEOUT_MS} ms.`)
}

try {
  await page.goto(`${KATEDRA_URL}/prijava?redirect=/pisi`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /Prijavi se/i }).click()
  await page.waitForURL(/\/pisi(?:\?|$)/, { timeout: 20_000 })
  await completeOnboarding()

  const editor = page.locator('.pis-prosemirror')
  await editor.waitFor({ state: 'visible', timeout: 30_000 })
  await editor.click()
  await editor.fill('Agentic staging odlomak.')

  await page.getByRole('button', { name: 'Revizija', exact: true }).click()
  await page.getByRole('heading', { name: 'Pregled rezultata' }).waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByRole('button', { name: 'Pripremi tijek', exact: true }).click()
  await page.getByRole('heading', { name: 'Priprema rada' }).waitFor({ state: 'visible', timeout: 30_000 })
  const pass = page.getByText('Pass aktivan', { exact: true })
  await pass.waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByRole('checkbox', { name: /Pristajem na privatnu privremenu pohranu/ }).check()
  await page.getByRole('button', { name: /Pokreni (autonomni )?tijek/i }).click()

  let terminalText = await waitForTerminalRun()
  if (/Potrebna je intervencija/i.test(terminalText)) {
    await page.getByRole('button', { name: 'Uredi kontekst i nastavi' }).click()
    const resumeResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/resume') && response.status() === 200, { timeout: TIMEOUT_MS })
    await page.getByRole('button', { name: 'Spremi kontekst i nastavi' }).click()
    await resumeResponse
    await page.waitForFunction(() => {
      const text = document.querySelector('.pis-agentic-dashboard')?.textContent || ''
      return !/Potrebna je intervencija/i.test(text)
    }, null, { timeout: TIMEOUT_MS })
    terminalText = await waitForTerminalRun()
  }
  assert.match(terminalText, /Tijek je završen/i, 'agent run must complete successfully')
  assert.doesNotMatch(terminalText, /Tijek je zaustavljen/i, 'agent run must not fail')
  assert.ok(apiResponses.some((response) => response.pathname === '/api/agent-runs' && response.status === 200), 'run creation must succeed')
  assert.ok(runRequests.some((request) => request.hasManuscript), 'run creation must include a manuscript context snapshot')
  if (browserErrors.length) throw new Error(`Browser page errors:\n${browserErrors.join('\n')}`)

  console.log('AGENTIC_WORKFLOW_BROWSER_E2E_PASS')
} finally {
  await browser.close()
}
