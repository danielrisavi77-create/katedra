import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = String(process.env.KATEDRA_PISI_URL || 'http://localhost:3000').replace(/\/$/u, '')
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))

try {
  await page.goto(`${baseUrl}/pisi?tip=d`, { waitUntil: 'domcontentloaded' })
  const newWork = page.getByRole('button', { name: /Novi rad/i })
  await newWork.waitFor({ state: 'visible' })
  if (await newWork.isVisible().catch(() => false)) {
    await newWork.click()
    await page.getByLabel(/Fakultet ili ustanova/i).fill('FPZG')
    await page.getByRole('option').filter({ hasText: /Fakultet politi/i }).first().waitFor({ state: 'visible' })
    await page.getByRole('option').filter({ hasText: /Fakultet politi/i }).first().click()
    await page.getByLabel(/Smjer \/ studij/i).fill('Politologija')
    await page.getByRole('option').filter({ hasText: /Politologija/i }).first().waitFor({ state: 'visible' })
    await page.getByRole('option').filter({ hasText: /Politologija/i }).first().click()
    await page.getByRole('button', { name: /Dalje/i }).click()
    await page.getByRole('button', { name: /Dalje/i }).click()
    await page.getByLabel(/Tema rada/i).fill('Stvarni produkcijski rukopis')
    await page.getByRole('button', { name: /Dalje/i }).click()
    await page.getByRole('button', { name: /Otvori projekt/i }).click()
    await page.getByText(/10\.000.*12\.000/u).first().waitFor({ state: 'visible' })
    await page.getByText(/15.*izvora/u).first().waitFor({ state: 'visible' })
    await page.getByRole('button', { name: /Nastavi u projektu/i }).click()
    await page.getByRole('heading', { name: 'Stvarni produkcijski rukopis' }).waitFor({ state: 'visible' })
    await page.getByText('Tvoj sljedeći korak').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Pisanje', exact: true }).click()
  }

  await page.getByLabel('Pitaj Katedru').waitFor({ state: 'visible' })
  const editor = page.getByLabel(/Tekst sekcije /i).first()
  await editor.fill('Ovo je tekst rukopisa za provjeru lokalnog spremanja.')
  await page.waitForTimeout(800)
  await page.getByRole('tab', { name: 'Kontekst' }).click()
  const policyRationale = page.getByRole('button', { name: /Zašto je ova AI radnja dopuštena ili blokirana/i }).first()
  await policyRationale.waitFor({ state: 'visible' })
  await policyRationale.click()
  const policySource = page.getByRole('link', { name: /Otvori službeni izvor/i }).first()
  await policySource.waitFor({ state: 'visible' })
  assert.match(await policySource.getAttribute('href'), /fpzg\.unizg\.hr/u)
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
  assert.match(await page.getByLabel(/Tekst sekcije /i).first().textContent(), /Ovo je tekst rukopisa za provjeru lokalnog spremanja\./u)
  await page.getByText('upute.txt', { exact: true }).waitFor({ state: 'visible' })
  await page.getByRole('tab', { name: 'Pomagala' }).click()
  await page.getByRole('button', { name: /Sljedeći najbolji korak/i }).waitFor({ state: 'visible' })
  assert.equal(await page.getByText('Interaktivni prototip').count(), 0)

  await page.getByRole('button', { name: 'Literatura', exact: true }).click()
  await page.getByRole('heading', { name: 'Literatura uz rukopis.' }).waitFor({ state: 'visible' })
  await page.getByPlaceholder('Naslov izvora').fill('Testirani izvor')
  await page.getByPlaceholder('DOI ili poveznica').fill('https://example.test/source')
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click()
  await page.getByText('Testirani izvor', { exact: true }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Provjeri izvor' }).click()
  await page.waitForFunction(() => document.querySelector('.pis-project-drawer')?.textContent?.includes('Potrebna je'))
  assert.match(await page.locator('.pis-project-drawer').innerText(), /Potrebna je .*provjera/u)
  await page.waitForTimeout(800)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Literatura', exact: true }).click()
  assert.match(await page.locator('.pis-project-drawer').innerText(), /Potrebna je .*provjera/u)

  await page.getByLabel('Projektni alati').getByRole('button', { name: 'Mentor', exact: true }).click()
  await page.getByPlaceholder(/Uvod treba jasniju tezu/i).fill('Dodaj primjer u analizu')
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click()
  await page.getByText('Dodaj primjer u analizu').waitFor({ state: 'visible' })

  await page.getByLabel('Projektni alati').getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByLabel(/Uvezi \.txt\/\.md/i).setInputFiles({ name: 'e2e-draft.txt', mimeType: 'text/plain', buffer: Buffer.from('Tekst za stvaranje lokalne verzije.') })
  await page.getByLabel('Projektni alati').getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByLabel('Projektni alati').getByRole('button', { name: 'Povijest', exact: true }).click()
  await page.getByRole('heading', { name: 'Lokalne verzije i AI zapis' }).waitFor({ state: 'visible' })
  await page.getByText(/Uvoz teksta: e2e-draft\.txt/u).waitFor({ state: 'visible' })
  await page.locator('.pis-version-entry').filter({ hasText: 'Uvoz teksta: e2e-draft.txt' }).first().getByRole('button', { name: 'Vrati ovu verziju' }).click()
  await page.evaluate(() => {
    const manifest = JSON.parse(localStorage.getItem('rp_manifest') || '{}')
    if (typeof manifest.projectId !== 'string') throw new Error('E2E project identity is missing')
    localStorage.setItem(`katedra_manuscript_log:${manifest.projectId}`, JSON.stringify([{
      occurredAt: new Date().toISOString(),
      kind: 'ai_proposal_accepted',
      action: 'E2E AI prijedlog',
      sectionId: 'e2e-section',
      userApproved: true,
    }]))
  })
  await page.getByLabel('Projektni alati').getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByLabel('Projektni alati').getByRole('button', { name: 'Povijest', exact: true }).click()
  await page.getByText('AI zapis', { exact: true }).waitFor({ state: 'visible' })
  await page.getByLabel('Projektni alati').getByRole('button', { name: 'Lekta', exact: true }).click()
  assert.match(await page.getByRole('link', { name: /Otvori projekt u Lekti/i }).getAttribute('href'), /project=/u)

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
