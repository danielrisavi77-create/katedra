import assert from 'node:assert/strict'
import { evaluateProductionEnvironment } from '../lib/deployment/preflight.mjs'

const KATEDRA_URL = String(process.env.KATEDRA_INTEGRATION_URL || '').replace(/\/$/, '')
const EMAIL = String(process.env.KATEDRA_AUTH_E2E_EMAIL || '')
const PASSWORD = String(process.env.KATEDRA_AUTH_E2E_PASSWORD || '')
const RUN_CHECKOUT = process.env.KATEDRA_AUTH_E2E_CHECKOUT === '1'
const REQUIRE_EXTERNAL_CONFIG = process.env.KATEDRA_E2E_REQUIRE_CONFIG === '1'

const production = evaluateProductionEnvironment(process.env)
const missingExternal = [
  ['KATEDRA_INTEGRATION_URL', KATEDRA_URL],
  ['KATEDRA_AUTH_E2E_EMAIL', EMAIL],
  ['KATEDRA_AUTH_E2E_PASSWORD', PASSWORD],
].filter(([, value]) => !value).map(([name]) => name)
const externalProblems = [...new Set([...missingExternal, ...production.missing, ...production.invalid])]
if (externalProblems.length) {
  console.log(`BLOCKED_EXTERNAL: authenticated money-flow E2E is not run without protected staging configuration: ${externalProblems.join(', ')}`)
  process.exit(REQUIRE_EXTERNAL_CONFIG ? 1 : 0)
}

const { chromium } = await import('playwright')

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()
const browserErrors = []
const chatResponses = []
page.on('pageerror', (error) => browserErrors.push(String(error)))
page.on('response', (response) => {
  if (new URL(response.url()).pathname === '/api/chat') {
    chatResponses.push({ status: response.status(), requestId: response.headers()['x-request-id'] || '' })
  }
})

async function completeOnboarding() {
  const newWork = page.getByRole('button', { name: /Novi rad/i })
  if (!(await newWork.isVisible().catch(() => false))) return
  await newWork.click()
  await page.getByLabel(/Fakultet ili ustanova/i).fill('FPZG')
  await page.getByRole('button', { name: /Dalje/i }).click()
  await page.getByRole('button', { name: /Dalje/i }).click()
  await page.getByLabel(/Tema rada/i).fill('Authenticated staging money flow')
  await page.getByRole('button', { name: /Dalje/i }).click()
  await page.getByRole('button', { name: /Otvori projekt/i }).click()
  await page.getByRole('button', { name: /Nastavi u projektu/i }).click()
  await page.getByRole('button', { name: /Nastavi pisati →/i }).click()
}

async function completeStripeTestCheckout() {
  await page.waitForURL(/checkout\.stripe\.com|stripe\.com/, { timeout: 30_000 })

  const cardNumber = page.locator('input[autocomplete="cc-number"], input[name="cardNumber"], input[name="cardnumber"]').first()
  await cardNumber.waitFor({ state: 'visible', timeout: 30_000 })
  await cardNumber.fill(process.env.KATEDRA_AUTH_E2E_CARD || '4242424242424242')

  const expiry = page.locator('input[autocomplete="cc-exp"], input[name="cardExpiry"], input[name="exp-date"]').first()
  if (await expiry.count()) await expiry.fill(process.env.KATEDRA_AUTH_E2E_CARD_EXPIRY || '12/34')
  const cvc = page.locator('input[autocomplete="cc-csc"], input[name="cardCvc"], input[name="cvc"]').first()
  if (await cvc.count()) await cvc.fill(process.env.KATEDRA_AUTH_E2E_CARD_CVC || '123')

  const name = page.locator('input[autocomplete="cc-name"], input[name="billingName"]').first()
  if (await name.count()) await name.fill('Katedra E2E')

  await page.getByRole('button', { name: /Pay|Plati|Plać|Naplat/i }).click()
  await page.waitForURL(/\/pisi(?:\?|$)/, { timeout: 60_000 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Pass aktivan/i }).waitFor({ state: 'visible', timeout: 60_000 })
}

try {
  await page.goto(`${KATEDRA_URL}/prijava?redirect=/pisi`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /Prijavi se/i }).click()
  await page.waitForURL(/\/pisi(?:\?|$)/, { timeout: 20_000 })

  await completeOnboarding()
  await page.getByRole('main').waitFor({ state: 'visible' })
  const editor = page.locator('.pis-prosemirror')
  await editor.waitFor({ state: 'visible' })
  await editor.click()
  await editor.fill('Authenticated staging odlomak rukopisa.')
  await page.waitForTimeout(800)

  if (RUN_CHECKOUT) {
    const passButton = page.getByRole('button', { name: /Aktiviraj Pass/i })
    if (await passButton.isVisible().catch(() => false)) {
      await passButton.click()
      await page.getByRole('checkbox').check()
      await page.getByRole('button', { name: /Nastavi na sigurno plaćanje/i }).click()
      await completeStripeTestCheckout()
    } else {
      console.log('CHECKOUT_SKIPPED_PASS_ALREADY_ACTIVE')
    }
  }

  const draftAction = page.getByRole('button', { name: /Napiši nacrt sekcije/i })
  await draftAction.waitFor({ state: 'visible' })
  await draftAction.click()
  await page.getByLabel('Tekst AI prijedloga').waitFor({ state: 'visible', timeout: 90_000 })
  const chat = chatResponses.at(-1)
  assert.equal(chat?.status, 200, `authenticated chat failed: ${JSON.stringify(chat)}`)
  assert.match(chat?.requestId || '', /^[A-Za-z0-9._:-]{1,100}$/, 'chat response must expose a request id')

  await page.getByRole('button', { name: 'Prihvati' }).click()
  await page.waitForTimeout(900)
  assert.ok(await editor.textContent(), 'accepted AI proposal must leave manuscript content')

  if (browserErrors.length) throw new Error(`Browser page errors:\n${browserErrors.join('\n')}`)
  console.log('AUTHENTICATED_MONEY_FLOW_BROWSER_E2E_PASS')
  console.log(JSON.stringify({ chatRequestId: chat.requestId, checkoutRequested: RUN_CHECKOUT }, null, 2))
} finally {
  await browser.close()
}
