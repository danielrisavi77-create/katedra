import assert from 'node:assert/strict'

const KATEDRA_URL = String(process.env.KATEDRA_INTEGRATION_URL || '').replace(/\/$/, '')
const EMAIL = String(process.env.KATEDRA_AUTH_E2E_EMAIL || '')
const PASSWORD = String(process.env.KATEDRA_AUTH_E2E_PASSWORD || '')
const TIMEOUT_MS = Number(process.env.KATEDRA_AGENT_E2E_TIMEOUT_MS || 180_000)

if (!KATEDRA_URL) throw new Error('KATEDRA_INTEGRATION_URL is required')
if (!EMAIL || !PASSWORD) throw new Error('KATEDRA_AUTH_E2E_EMAIL and KATEDRA_AUTH_E2E_PASSWORD are required')

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
  await page.getByLabel(/Tema rada/i).fill('Agentic staging workflow')
  await page.getByRole('button', { name: /Otvori rukopis/i }).click()
}

async function waitForTerminalRun() {
  const deadline = Date.now() + TIMEOUT_MS
  while (Date.now() < deadline) {
    const run = page.locator('.pis-agentic-dashboard')
    const text = await run.textContent().catch(() => '')
    if (/Potrebna je intervencija|Tijek je završen|Tijek je otkazan|Tijek je zaustavljen/i.test(text || '')) return text || ''
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
  await page.getByRole('button', { name: /Pokreni (autonomni )?tijek/i }).click()

  const terminalText = await waitForTerminalRun()
  if (/Potrebna je intervencija/i.test(terminalText)) {
    await page.getByRole('button', { name: 'Uredi kontekst i nastavi' }).click()
    await page.getByRole('button', { name: 'Spremi kontekst i nastavi' }).click()
    await page.locator('.pis-agentic-dashboard').waitFor({ state: 'visible', timeout: TIMEOUT_MS })
  }
  assert.doesNotMatch(terminalText, /Tijek je zaustavljen/i, 'agent run must not fail')
  assert.ok(apiResponses.some((response) => response.pathname === '/api/agent-runs' && response.status === 200), 'run creation must succeed')
  assert.ok(runRequests.some((request) => request.hasManuscript), 'run creation must include a manuscript context snapshot')
  if (browserErrors.length) throw new Error(`Browser page errors:\n${browserErrors.join('\n')}`)

  console.log('AGENTIC_WORKFLOW_BROWSER_E2E_PASS')
} finally {
  await browser.close()
}
