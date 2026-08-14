import assert from 'node:assert/strict'

const baseUrl = String(process.env.KATEDRA_INTEGRATION_URL || '').replace(/\/$/u, '')
const email = String(process.env.KATEDRA_AUTH_E2E_EMAIL || '')
const password = String(process.env.KATEDRA_AUTH_E2E_PASSWORD || '')
if (!baseUrl || !email || !password) throw new Error('KATEDRA_INTEGRATION_URL, KATEDRA_AUTH_E2E_EMAIL and KATEDRA_AUTH_E2E_PASSWORD are required')

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
  await page.getByRole('button', { name: 'Agenti', exact: true }).click()
  await page.getByRole('heading', { name: 'Priprema rada' }).waitFor({ state: 'visible', timeout: 30_000 })

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    assert.equal(overflow, false, `horizontal overflow at ${width}px`)
    assert.ok(await page.getByText('Priprema rada', { exact: true }).count(), `phase label missing at ${width}px`)
  }

  await page.getByRole('button', { name: /tamnu temu|dark/i }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  await page.getByRole('button', { name: /svijetlu temu|light/i }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme !== 'dark')
  if (errors.length) throw new Error(`Browser page errors:\n${errors.join('\n')}`)
  console.log('AGENTIC_WORKSPACE_UI_BROWSER_E2E_PASS')
} finally {
  await browser.close()
}
