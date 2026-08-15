import assert from 'node:assert/strict'

const baseUrl = String(process.env.KATEDRA_INTEGRATION_URL || '').replace(/\/$/u, '')
const email = String(process.env.KATEDRA_AUTH_E2E_EMAIL || '')
const password = String(process.env.KATEDRA_AUTH_E2E_PASSWORD || '')
function evaluateAgenticStagingEnvironment(env = process.env) {
  const required = [
    'KATEDRA_WORKER_APP_URL',
    'KATEDRA_AGENT_WORKER_TOKEN',
    'KATEDRA_AGENT_WORKER_CRON_SECRET',
    'KATEDRA_AGENT_MODEL',
    'KATEDRA_AGENT_RUNS_ENABLED',
    'KATEDRA_PROJECT_LOCKS_ENABLED',
    'KATEDRA_BILLING_RPC_CONTRACT',
    'KATEDRA_RATE_LIMIT_STORE',
  ]
  const configured = (value) => typeof value === 'string' && value.trim() && !value.trim().startsWith('REPLACE_')
  const missing = required.filter((key) => !configured(env[key]))
  const invalid = []
  if (configured(env.KATEDRA_WORKER_APP_URL)) {
    try {
      if (new URL(env.KATEDRA_WORKER_APP_URL).protocol !== 'https:') invalid.push('KATEDRA_WORKER_APP_URL')
    } catch {
      invalid.push('KATEDRA_WORKER_APP_URL')
    }
  }
  if (configured(env.KATEDRA_AGENT_RUNS_ENABLED) && env.KATEDRA_AGENT_RUNS_ENABLED !== 'true') invalid.push('KATEDRA_AGENT_RUNS_ENABLED')
  if (configured(env.KATEDRA_PROJECT_LOCKS_ENABLED) && env.KATEDRA_PROJECT_LOCKS_ENABLED !== 'true') invalid.push('KATEDRA_PROJECT_LOCKS_ENABLED')
  if (configured(env.KATEDRA_BILLING_RPC_CONTRACT) && env.KATEDRA_BILLING_RPC_CONTRACT !== 'v2') invalid.push('KATEDRA_BILLING_RPC_CONTRACT')
  if (configured(env.KATEDRA_RATE_LIMIT_STORE) && env.KATEDRA_RATE_LIMIT_STORE !== 'supabase') invalid.push('KATEDRA_RATE_LIMIT_STORE')
  return { missing: [...new Set(missing)], invalid: [...new Set(invalid)] }
}

const staging = evaluateAgenticStagingEnvironment(process.env)
const missingExternal = [
  ['KATEDRA_INTEGRATION_URL', baseUrl],
  ['KATEDRA_AUTH_E2E_EMAIL', email],
  ['KATEDRA_AUTH_E2E_PASSWORD', password],
].filter(([, value]) => !value).map(([name]) => name)
const externalProblems = [...new Set([...missingExternal, ...staging.missing, ...staging.invalid])]
if (externalProblems.length) {
  console.log(`BLOCKED_EXTERNAL: authenticated agentic workspace UI is not run without canonical staging contracts: ${externalProblems.join(', ')}`)
  process.exit(0)
}

const { chromium } = await import('playwright')
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))

try {
  await page.goto(`${baseUrl}/prijava?redirect=/pisi`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /Prijavi se/i }).click()
  await page.waitForURL(/\/pisi(?:\?|$)/u, { timeout: 20_000 })
  await page.getByRole('button', { name: 'Revizija', exact: true }).click()
  await page.getByRole('heading', { name: 'Pregled rezultata' }).waitFor({ state: 'visible', timeout: 30_000 })

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    assert.equal(overflow, false, `horizontal overflow at ${width}px`)
    assert.ok(await page.getByText('Pregled rezultata', { exact: true }).count(), `review label missing at ${width}px`)
  }

  await page.getByRole('button', { name: /tamnu temu|dark/i }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  await page.getByRole('button', { name: /svijetlu temu|light/i }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme !== 'dark')
  if (errors.length) throw new Error(`Browser page errors:\n${errors.join('\n')}`)
  console.log('AGENTIC_WORKSPACE_UI_STAGING_E2E_PASS')
} finally {
  await browser.close()
}
