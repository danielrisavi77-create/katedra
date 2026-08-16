import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = String(process.env.KATEDRA_PISI_URL || 'http://localhost:3000').replace(/\/$/u, '')
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))

try {
  await page.goto(`${baseUrl}/pisi?tip=z`, { waitUntil: 'domcontentloaded' })
  const newWork = page.getByRole('button', { name: /Novi rad/i })
  await newWork.waitFor({ state: 'visible' })
  if (await newWork.isVisible().catch(() => false)) {
    await newWork.click()
    await page.getByLabel(/Fakultet ili ustanova/i).fill('FPZG')
    await page.getByRole('button', { name: /Dalje/i }).click()
    await page.getByRole('button', { name: /Dalje/i }).click()
    await page.getByLabel(/Tema rada/i).fill('Stvarni produkcijski rukopis')
    await page.getByRole('button', { name: /Dalje/i }).click()
    await page.getByRole('button', { name: /Otvori projekt/i }).click()
    await page.getByRole('button', { name: /Nastavi u projektu/i }).click()
    await page.getByRole('button', { name: 'Pisanje', exact: true }).click()
  }

  await page.getByLabel('Pitaj Katedru').waitFor({ state: 'visible' })
  const requestType = page.getByLabel('Vrsta zahtjeva')
  await requestType.waitFor({ state: 'visible' })
  assert.equal(await requestType.inputValue(), 'question')
  assert.ok(await requestType.locator('option[value="draft"]').count(), 'composer should expose an explicit draft action')
  const uploader = page.getByLabel('Dodaj materijal u chat')
  await uploader.waitFor({ state: 'visible' })
  await uploader.setInputFiles({ name: 'upute.txt', mimeType: 'text/plain', buffer: Buffer.from('Mentorove upute za uvod.') })
  await page.getByText('upute.txt', { exact: true }).waitFor({ state: 'visible' })
  await page.waitForFunction(() => Object.keys(localStorage).some((key) => key.startsWith('katedra_composer_materials_v1:')))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByLabel('Pitaj Katedru').waitFor({ state: 'visible' })
  await page.getByText('upute.txt', { exact: true }).waitFor({ state: 'visible' })
  await page.getByRole('tab', { name: 'Pomagala' }).click()
  await page.getByRole('button', { name: /Sljedeći najbolji korak/i }).waitFor({ state: 'visible' })
  assert.equal(await page.getByText('Interaktivni prototip').count(), 0)

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 1, `${width}px viewport has horizontal overflow of ${overflow}px`)
  }

  assert.deepEqual(errors, [], `browser page errors:\n${errors.join('\n')}`)
  console.log('PISI_WORKSPACE_BROWSER_E2E_PASS')
} finally {
  await browser.close()
}
