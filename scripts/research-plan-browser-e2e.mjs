import assert from 'node:assert/strict'
import { chromium } from 'playwright'

// This scenario covers the Research Design Canvas and Methodology Builder.

const baseUrl = String(process.env.KATEDRA_PISI_URL || 'http://localhost:3000').replace(/\/$/u, '')
const storageState = String(process.env.KATEDRA_RESEARCH_E2E_STORAGE_STATE || '')
const email = String(process.env.KATEDRA_AUTH_E2E_EMAIL || '')
const password = String(process.env.KATEDRA_AUTH_E2E_PASSWORD || '')
const researchFlag = String(process.env.KATEDRA_RESEARCH_MODULES_ENABLED || 'false')

if (!storageState && (!email || !password)) {
  console.log('BLOCKED_EXTERNAL: research plan browser E2E treba KATEDRA_RESEARCH_E2E_STORAGE_STATE ili KATEDRA_AUTH_E2E_EMAIL/KATEDRA_AUTH_E2E_PASSWORD; KATEDRA_RESEARCH_MODULES_ENABLED=' + researchFlag)
  process.exit(0)
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ ...(storageState ? { storageState } : {}), viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))

async function openResearchPlan() {
  await page.getByRole('menuitem', { name: /^Projekt$/i }).click()
  await page.getByRole('button', { name: 'Istraživački plan', exact: true }).waitFor({ state: 'visible', timeout: 15_000 })
  await page.getByRole('button', { name: 'Istraživački plan', exact: true }).click()
  await page.getByRole('heading', { name: 'Istraživački plan' }).waitFor({ state: 'visible' })
}

try {
  if (email && password && !storageState) {
    await page.goto(`${baseUrl}/prijava?redirect=/pisi`, { waitUntil: 'domcontentloaded' })
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /Prijavi se/i }).click()
    await page.waitForURL(/\/pisi(?:\?|$)/u, { timeout: 20_000 })
  } else {
    await page.goto(`${baseUrl}/pisi?tip=d`, { waitUntil: 'domcontentloaded' })
  }

  const newWork = page.getByRole('button', { name: /Novi rad/i })
  if (await newWork.isVisible().catch(() => false)) {
    await newWork.click()
    await page.getByLabel(/Fakultet ili ustanova/i).fill('FPZG')
    await page.getByRole('option').filter({ hasText: /Fakultet politi/i }).first().click()
    await page.getByLabel(/Smjer \/ studij/i).fill('Politologija')
    await page.getByRole('option').filter({ hasText: /Politologija/i }).first().click()
    await page.getByRole('button', { name: /Dalje/i }).click()
    await page.getByRole('button', { name: /Dalje/i }).click()
    await page.getByLabel(/Tema rada/i).fill('Istraživački plan browser test')
    await page.getByRole('button', { name: /Dalje/i }).click()
    await page.getByRole('button', { name: /Otvori projekt/i }).click()
    await page.getByRole('button', { name: /Nastavi u projektu/i }).click()
  }

  await page.getByRole('menuitem', { name: /^Projekt$/i }).waitFor({ state: 'visible', timeout: 20_000 })
  await openResearchPlan()
  await page.getByRole('button', { name: 'Započni plan' }).click()
  await page.getByLabel('Problem').fill('Nedovoljno je jasno kako se problem mijenja u odabranom kontekstu.')
  await page.getByLabel('Cilj istraživanja').fill('Objasniti odnos između problema i konteksta.')
  await page.getByLabel('Istraživačko pitanje').fill('Kako se problem pojavljuje u odabranom slučaju?')
  await page.getByLabel('Dizajn istraživanja').fill('Kvalitativna studija slučaja.')
  await page.getByLabel('Uzorak').fill('Namjerni uzorak relevantnih aktera.')
  await page.getByLabel('Operacionalizacija').fill('Ključni pojmovi definirani kroz kodirne kategorije.')
  await page.getByLabel('Instrument').fill('Polustrukturirani intervju.')
  await page.getByLabel('Analiza').fill('Tematska analiza transkripata.')
  await page.getByLabel('Ograničenja').fill('Ograničen broj slučajeva i dostupnost sudionika.')
  await page.getByLabel('Etika').fill('Informirani pristanak i anonimizacija podataka.')
  await page.getByRole('button', { name: /Dodaj hipotezu/i }).click()
  await page.getByLabel('Hipoteze 1').fill('Kontekst utječe na način na koji se problem tumači.')
  await page.waitForTimeout(800)
  await page.getByText('Spremljeno lokalno').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Pošalji na pregled' }).click()
  await page.getByRole('button', { name: 'Odobri plan' }).waitFor({ state: 'visible' })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('menuitem', { name: /^Projekt$/i }).waitFor({ state: 'visible', timeout: 20_000 })
  await openResearchPlan()
  assert.equal(await page.getByLabel('Istraživačko pitanje').inputValue(), 'Kako se problem pojavljuje u odabranom slučaju?')
  assert.equal(await page.getByLabel('Analiza').inputValue(), 'Tematska analiza transkripata.')

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 1, `${width}px viewport has horizontal overflow of ${overflow}px`)
  }

  assert.deepEqual(errors, [], `browser page errors:\n${errors.join('\n')}`)
  console.log('RESEARCH_PLAN_BROWSER_E2E_PASS')
} finally {
  await browser.close()
}
