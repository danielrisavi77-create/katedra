import assert from 'node:assert/strict'

const baseUrl = String(process.env.KATEDRA_INTEGRATION_URL || 'http://localhost:3000').replace(/\/$/u, '')
const routes = ['/', '/pisi', '/racun', '/prijava', '/registracija', '/privatnost', '/uvjeti']
const themes = ['light', 'dark']
const widths = [390, 768, 1440]
const browserErrors = []
const storageKey = 'katedra-theme'

const { chromium } = await import('playwright')
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

page.on('pageerror', (error) => {
  browserErrors.push({ url: page.url(), message: String(error) })
})

function describeSurface(path, theme, width) {
  return `${path} · ${theme} · ${width}px`
}

async function waitForSurface(label) {
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 20_000 }).catch((error) => {
    throw new Error(`${label}: main nije prikazan: ${error.message}`)
  })
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 20_000 }).catch((error) => {
    throw new Error(`${label}: h1 nije prikazan: ${error.message}`)
  })
}

async function assertPageContract(label) {
  await waitForSurface(label)
  const mainCount = await page.locator('main').count()
  const headingCount = await page.locator('h1').count()
  assert.equal(mainCount, 1, `${label}: očekivan je točno jedan main, dobiveno ${mainCount}`)
  assert.equal(headingCount, 1, `${label}: očekivan je točno jedan h1, dobiveno ${headingCount}`)

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    theme: document.documentElement.dataset.theme || '',
  }))
  assert.ok(
    Math.max(dimensions.documentWidth, dimensions.bodyWidth) <= dimensions.clientWidth + 1,
    `${label}: horizontalni overflow (${JSON.stringify(dimensions)})`,
  )
}

async function gotoWithTheme(path, theme) {
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [storageKey, theme])
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme, { timeout: 10_000 })
}

async function completeGuestOnboarding() {
  await page.goto(`${baseUrl}/pisi?tip=d`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Novi rad/i }).click()

  const faculty = page.getByRole('combobox', { name: /Fakultet ili ustanova/i })
  await faculty.fill('FPZG')
  const facultyOption = page.getByRole('option').filter({ hasText: /Fakultet političkih znanosti/i }).first()
  await facultyOption.waitFor({ state: 'visible', timeout: 15_000 })
  await facultyOption.click()

  const program = page.getByRole('combobox', { name: /Smjer \/ studij/i })
  await program.fill('Politologija')
  const programOption = page.getByRole('option').filter({ hasText: /Politologija/i }).first()
  await programOption.waitFor({ state: 'visible', timeout: 15_000 })
  await programOption.click()
  await page.getByRole('button', { name: /Dalje/i }).click()

  await page.getByRole('button', { name: /Imam temu/i }).click()
  await page.getByRole('button', { name: /Dalje/i }).click()
  await page.getByLabel(/Tema rada/i).fill('Utjecaj javne komunikacije na povjerenje građana')
  await page.getByRole('button', { name: /Dalje/i }).click()
  await page.getByRole('button', { name: /Otvori projekt/i }).click()

  await page.getByRole('heading', { name: /Znaš gdje si/i }).waitFor({ state: 'visible', timeout: 15_000 })
  await page.getByRole('button', { name: /Nastavi u projektu/i }).click()
  await page.getByRole('heading', { name: 'Utjecaj javne komunikacije na povjerenje građana', exact: true }).waitFor({ state: 'visible', timeout: 15_000 })

  const primaryActions = page.locator('[data-primary-action="true"]')
  assert.equal(await primaryActions.count(), 1, 'projektni pregled mora imati točno jednu primarnu akciju')
  assert.ok(await primaryActions.first().isVisible(), 'primarna akcija mora biti vidljiva')
}

async function enterWritingWorkspace() {
  const desktopWriting = page.getByRole('button', { name: 'Pisanje', exact: true })
  if (await desktopWriting.isVisible().catch(() => false)) {
    await desktopWriting.click()
  } else {
    await page.getByRole('button', { name: 'Rukopis', exact: true }).click()
  }
  await page.locator('.pis-prosemirror').waitFor({ state: 'visible', timeout: 15_000 })
  await page.getByRole('heading', { name: 'Aktivna sekcija', exact: false }).waitFor({ state: 'visible' }).catch(() => undefined)
}

async function verifyAutosaveAndReload() {
  const editor = page.locator('.pis-prosemirror')
  const text = 'Ovaj odlomak potvrđuje lokalno spremanje rukopisa kroz stvarni korisnički tijek.'
  await editor.click()
  await editor.fill(text)
  await page.locator('.pis-save-state[data-state="saved"]').waitFor({ state: 'visible', timeout: 10_000 })
  assert.match((await editor.textContent()) || '', /lokalno spremanje rukopisa/i)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.pis-prosemirror').waitFor({ state: 'visible', timeout: 15_000 })
  assert.match((await page.locator('.pis-prosemirror').textContent()) || '', /lokalno spremanje rukopisa/i, 'rukopis nije vraćen nakon reloada')
}

async function verifyDrawerAndAssistant() {
  const plan = page.getByRole('button', { name: 'Plan', exact: true })
  if (await plan.isVisible().catch(() => false)) {
    await plan.click()
  } else {
    await page.getByRole('button', { name: /Dodatne radnje/i }).click()
    await page.getByRole('menuitem', { name: 'Projekt', exact: true }).click()
  }
  await page.getByRole('dialog', { name: /Utjecaj javne komunikacije/i }).waitFor({ state: 'visible', timeout: 10_000 })
  await page.getByRole('button', { name: 'Zatvori projektne alate' }).click()
  await page.getByRole('complementary', { name: /Katedra urednik/i }).waitFor({ state: 'visible', timeout: 10_000 })
}

async function verifyWorkspaceAtWidth(width, theme) {
  await page.setViewportSize({ width, height: width < 800 ? 844 : 900 })
  await gotoWithTheme('/pisi', theme)
  const label = describeSurface('/pisi project', theme, width)
  await assertPageContract(label)

  if (width <= 768) {
    const mobileNav = page.getByRole('navigation', { name: 'Radni prostor' })
    const buttons = mobileNav.getByRole('button')
    assert.equal(await buttons.count(), 3, `${label}: mobilna navigacija mora imati tri konteksta`)
    assert.deepEqual(await buttons.allTextContents(), ['≡Pregled', '✎Rukopis', 'KKatedra'])
    assert.equal(await mobileNav.locator('[aria-current="page"]').count(), 1, `${label}: jedan aktivni mobilni kontekst`)
    await mobileNav.getByRole('button', { name: 'Katedra', exact: true }).click()
    await page.locator('.pis-assistant').waitFor({ state: 'visible', timeout: 10_000 })
    await mobileNav.getByRole('button', { name: 'Rukopis', exact: true }).click()
  } else {
    const projectNav = page.getByRole('navigation', { name: 'Projekt' })
    for (const labelText of ['Početna', 'Plan', 'Literatura', 'Pisanje', 'Mentor', 'Revizija', 'Provjera u Lekti', 'Povijest']) {
      await projectNav.getByRole('button', { name: labelText, exact: true }).waitFor({ state: 'visible' })
    }
    assert.equal(await projectNav.locator('[aria-current="page"]').count(), 1, `${label}: jedan aktivni projektni kontekst`)
  }
}

async function verifyRouteMatrix() {
  for (const theme of themes) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 800 ? 844 : 900 })
      for (const route of routes) {
        console.log(`CHECK ${describeSurface(route, theme, width)}`)
        await gotoWithTheme(route, theme)
        const label = describeSurface(route, theme, width)
        await assertPageContract(label)
        if (route === '/pisi' && width >= 1440) {
          const projectNav = page.getByRole('navigation', { name: 'Projekt' })
          assert.equal(await projectNav.getByRole('button').count(), 9, `${label}: neočekivan broj projektnih ciljeva`)
        }
      }
    }
  }
}

function reportExternalGate() {
  const externalVariables = [
    'KATEDRA_INTEGRATION_URL',
    'KATEDRA_AUTH_E2E_EMAIL',
    'KATEDRA_AUTH_E2E_PASSWORD',
    'KATEDRA_WORKER_APP_URL',
    'KATEDRA_AGENT_MODEL',
    'KATEDRA_AGENT_RUNS_ENABLED',
    'KATEDRA_PROJECT_LOCKS_ENABLED',
    'KATEDRA_BILLING_RPC_CONTRACT',
    'KATEDRA_RATE_LIMIT_STORE',
  ]
  const missing = externalVariables.filter((name) => !String(process.env[name] || '').trim())
  console.log(`BLOCKED_EXTERNAL: authenticated checkout/webhook/worker/provider journey is not claimed by local UI QA; missing configuration: ${missing.length ? missing.join(', ') : 'canonical staging proof is still required'}`)
}

try {
  await completeGuestOnboarding()
  await enterWritingWorkspace()
  await verifyAutosaveAndReload()
  await verifyDrawerAndAssistant()
  for (const theme of themes) {
    for (const width of widths) await verifyWorkspaceAtWidth(width, theme)
  }
  await verifyRouteMatrix()

  if (browserErrors.length) {
    throw new Error(`Browser page errors:\n${browserErrors.map((entry) => `${entry.url}: ${entry.message}`).join('\n')}`)
  }

  reportExternalGate()
  console.log('HYBRID_MENTOR_UI_BROWSER_E2E_PASS')
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error)
  console.error(`HYBRID_MENTOR_UI_BROWSER_E2E_FAIL: ${detail}`)
  if (browserErrors.length) console.error(`Captured browser errors:\n${JSON.stringify(browserErrors, null, 2)}`)
  process.exitCode = 1
} finally {
  await browser.close()
}
