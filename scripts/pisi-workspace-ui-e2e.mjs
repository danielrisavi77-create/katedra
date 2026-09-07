import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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

  // Synthetic local metadata exercises the real History/export UI. This is
  // not an authenticated chat/provider or billing integration assertion.
  await page.evaluate(() => {
    const readyKey = Object.keys(localStorage).find(key => key.startsWith('katedra_manuscript_ready:'))
    if (!readyKey) throw new Error('Synthetic workspace project was not persisted')
    const projectId = readyKey.slice('katedra_manuscript_ready:'.length)
    localStorage.setItem(`katedra_ai_ledger_v1:${projectId}`, JSON.stringify({
      schemaVersion: 1, projectId, entries: [{
        projectId, proposalId: 'browser-proposal-1', sectionId: 'browser-section-1', action: 'draft',
        requestedAt: '2026-09-08T00:00:00.000Z', outcome: 'requested', decision: 'none',
        prompt: 'SYNTHETIC_PRIVATE_PROMPT', output: 'SYNTHETIC_PRIVATE_OUTPUT',
      }],
    }))
  })
  await page.getByRole('button', { name: 'Povijest', exact: true }).first().click()
  await page.getByRole('heading', { name: 'Lokalna povijest projekta' }).waitFor()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Izvezi AI evidenciju' }).click()
  const download = await downloadPromise
  const exported = await readFile(await download.path(), 'utf8')
  assert.doesNotMatch(exported, /SYNTHETIC_PRIVATE/)
  assert.equal(JSON.parse(exported).entries[0].outcome, 'requested')
  assert.equal(JSON.parse(exported).entries[0].billing, 'unknown')
  await page.getByRole('button', { name: 'Zatvori projektne alate' }).click()

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
