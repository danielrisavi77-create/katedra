import assert from 'node:assert/strict'

const baseUrl = String(process.env.KATEDRA_INTEGRATION_URL || 'http://localhost:3000').replace(/\/$/u, '')
const projectId = 'agent-studio-ui-smoke-project'

const { chromium } = await import('playwright')
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(String(error)))

try {
  await page.addInitScript(({ projectId }) => {
    window.localStorage.setItem('rp_manifest', JSON.stringify({
      v: 1,
      projectId,
      topic: 'Agent Studio lokalna provjera',
      workType: 'z',
      institution: 'Fakultet političkih znanosti',
      program: 'Politologija',
    }))
    window.localStorage.setItem(`katedra_project_setup_v1:${projectId}`, '1')
    window.localStorage.removeItem(`katedra_workspace_view_v2:${projectId}`)
  }, { projectId })

  await page.goto(`${baseUrl}/pisi?projectId=${encodeURIComponent(projectId)}`, { waitUntil: 'domcontentloaded' })
  // `/pisi` intentionally opens on the project dashboard. The agent studio is
  // an explicit workspace, not the default screen after onboarding.
  await page.getByRole('button', { name: 'Radionica', exact: true }).click()
  await page.getByRole('heading', { name: 'Radionica Katedre' }).waitFor({ state: 'visible', timeout: 20_000 })
  await page.getByText('Rukopis uživo', { exact: true }).waitFor({ state: 'visible' })
  assert.equal(await page.locator('.pis-agent-studio-shell').count(), 1)
  assert.equal(await page.locator('.pis-writing-frame').count(), 0)

  await page.getByRole('button', { name: 'Otvori rukopis' }).click()
  await page.locator('.pis-writing-frame').waitFor({ state: 'visible', timeout: 10_000 })
  assert.equal(await page.getByRole('navigation', { name: 'Struktura rada' }).count(), 1)

  await page.getByRole('button', { name: 'Radionica', exact: true }).click()
  await page.getByRole('heading', { name: 'Radionica Katedre' }).waitFor({ state: 'visible', timeout: 10_000 })

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 })
    const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
    assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 1, `horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`)
  }

  if (pageErrors.length) throw new Error(`Browser page errors:\n${pageErrors.join('\n')}`)
  console.log('AGENT_STUDIO_UI_SMOKE_PASS')
} catch (error) {
  console.error(`AGENT_STUDIO_UI_SMOKE_FAIL: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await browser.close()
}
