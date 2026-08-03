import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const KATEDRA_URL = String(process.env.KATEDRA_E2E_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const LEKTA_PREVIEW_URL = String(process.env.LEKTA_PREVIEW_URL || '').replace(/\/$/, '')

if (!LEKTA_PREVIEW_URL) throw new Error('LEKTA_PREVIEW_URL is required')

function handoffFragment(value) {
  return `#lekta=${encodeURIComponent(Buffer.from(JSON.stringify(value), 'utf8').toString('base64'))}`
}

function result(projectId, analysisId, issues) {
  return {
    schemaVersion: '0.1', analysisId, projectId,
    rulesetId: 'e2e:fpzg-graduate:v1', profileId: 'fpzg-e2e-graduate',
    score: issues.length ? 82 : 100,
    scoreLabel: issues.length ? 'Potrebne su dorade' : 'Visoka usklađenost s profilom',
    profileStatus: 'verified', categoryScores: [], issues,
    analyzedAt: new Date().toISOString(),
  }
}

const stableMarginIssue = {
  issueKey: 'rule:e2e.margins.001', checkId: 'margins', ruleId: 'e2e.margins.001',
  category: 'formatting', severity: 'warning', summary: 'E2E: margine odstupaju od profila',
  fixable: true, fixerId: 'margins-fixer', status: 'OPEN',
}

async function manifest(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('rp_manifest') || 'null'))
}

async function waitManifest(page, predicate, label, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    last = await manifest(page)
    if (last && predicate(last)) return last
    await page.waitForTimeout(75)
  }
  throw new Error(`Timed out waiting for manifest state: ${label}\nLast manifest: ${JSON.stringify(last)}`)
}

async function clickWithoutNavigation(page, locator) {
  await page.evaluate(() => {
    document.addEventListener('click', event => event.preventDefault(), { once: true })
  })
  await locator.click()
}

/**
 * Katedra onboarding is a CSS checkbox overlay: `#onbx:checked ~ .onb`
 * switches the overlay to `display:none` after the real Kreni control is used.
 */
async function completeOnboarding(page) {
  const overlay = page.locator('#onb')
  if (!(await overlay.isVisible().catch(() => false))) return

  const start = overlay.getByRole('button', { name: /Kreni/i })
  await start.waitFor({ state: 'visible' })
  await start.click()

  await page.waitForFunction(() => {
    const checkbox = document.querySelector('#onbx')
    const overlay = document.querySelector('#onb')
    return Boolean(checkbox?.checked) && overlay && getComputedStyle(overlay).display === 'none'
  })
}

async function startResolutionRound(page) {
  const start = page.getByRole('button', { name: /Idemo redom/i }).first()
  await start.waitFor({ state: 'visible' })
  await start.click()
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()
const browserErrors = []
page.on('pageerror', error => browserErrors.push(String(error)))

try {
  // A. Real Katedra guest identity exists before auth.
  await page.goto(`${KATEDRA_URL}/`, { waitUntil: 'domcontentloaded' })
  const initial = await waitManifest(
    page,
    m => typeof m.projectId === 'string' && m.projectId.length > 10,
    'guest projectId',
  )
  const projectId = initial.projectId
  assert.ok(projectId)
  await completeOnboarding(page)

  // B. Real Lekta PR preview accepts Katedra routing metadata and isolates it
  // to Katedra-origin navigation in this tab.
  const lektaPage = await context.newPage()
  const previewEntry = `${LEKTA_PREVIEW_URL}/?project=${encodeURIComponent(projectId)}&unit=fpzg&work=diplomski`
  await lektaPage.goto(previewEntry, { waitUntil: 'domcontentloaded' })
  await lektaPage.waitForFunction(
    expected => sessionStorage.getItem('lekta.katedra-project.v0.1') === expected,
    projectId,
  )

  const workTypeSelect = lektaPage.locator('#workType')
  if (await workTypeSelect.count()) {
    await lektaPage.waitForFunction(() => document.querySelector('#workType')?.value === 'graduate')
    assert.equal(await workTypeSelect.inputValue(), 'graduate')
  }

  const unitSelect = lektaPage.locator('#unitSelect')
  if (await unitSelect.count()) {
    await lektaPage.waitForFunction(() => document.querySelector('#unitSelect')?.value === 'fpzg')
    assert.equal(await unitSelect.inputValue(), 'fpzg')
  }

  await lektaPage.goto(`${LEKTA_PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' })
  await lektaPage.waitForFunction(() => sessionStorage.getItem('lekta.katedra-project.v0.1') === null)
  await lektaPage.close()

  // C. First canonical LektaResult arrives: OPEN.
  await page.goto(`${KATEDRA_URL}/${handoffFragment(result(projectId, 'e2e-analysis-1', [stableMarginIssue]))}`, {
    waitUntil: 'domcontentloaded',
  })
  let state = await waitManifest(
    page,
    m => m.lektaIssues?.length === 1 && m.lektaIssues[0].id === 'rule:e2e.margins.001',
    'first OPEN issue',
  )
  assert.equal(state.lektaIssues[0].status, 'OPEN')
  assert.equal(state.lektaIdentityIndex?.['rule:e2e.margins.001']?.checkId, 'margins')
  assert.equal(state.lektaIdentityIndex?.['rule:e2e.margins.001']?.ruleId, 'e2e.margins.001')

  // D. Follow the real coach UX: start the round, then mark the item changed.
  await startResolutionRound(page)
  const solved = page.getByRole('button', { name: /Riješio sam/i }).first()
  await solved.waitFor({ state: 'visible' })
  await solved.click()
  state = await waitManifest(page, m => m.lektaIssues?.[0]?.status === 'USER_CHANGED', 'USER_CHANGED')
  assert.equal(state.lektaIssues[0].status, 'USER_CHANGED')

  // E. Starting an actual project-bound re-check advances to RECHECK_REQUIRED.
  const recheck = page.getByRole('link', { name: /Ponovi Lekta Check/i }).first()
  await recheck.waitFor({ state: 'visible' })
  const recheckHref = await recheck.getAttribute('href')
  assert.ok(recheckHref?.includes(`project=${encodeURIComponent(projectId)}`), 're-check link must carry projectId')
  await clickWithoutNavigation(page, recheck)
  state = await waitManifest(page, m => m.lektaIssues?.[0]?.status === 'RECHECK_REQUIRED', 'RECHECK_REQUIRED')
  assert.equal(state.lektaIssues[0].status, 'RECHECK_REQUIRED')

  // F. Finding persists in fresh analysis -> OPEN again.
  await page.goto(`${KATEDRA_URL}/${handoffFragment(result(projectId, 'e2e-analysis-2', [stableMarginIssue]))}`, {
    waitUntil: 'domcontentloaded',
  })
  state = await waitManifest(
    page,
    m => m.lektaIssues?.length === 1 && m.lektaIssues[0].status === 'OPEN',
    'persistent finding reopened',
  )
  assert.equal(state.lektaIssues[0].id, 'rule:e2e.margins.001')
  assert.equal(state.lektaResolutionHistory?.length || 0, 0)

  // G. Change again and start another re-check through the real coach UX.
  await startResolutionRound(page)
  const solvedAgain = page.getByRole('button', { name: /Riješio sam/i }).first()
  await solvedAgain.waitFor({ state: 'visible' })
  await solvedAgain.click()
  const recheckAgain = page.getByRole('link', { name: /Ponovi Lekta Check/i }).first()
  await recheckAgain.waitFor({ state: 'visible' })
  await clickWithoutNavigation(page, recheckAgain)
  await waitManifest(page, m => m.lektaIssues?.[0]?.status === 'RECHECK_REQUIRED', 'second RECHECK_REQUIRED')

  // H. Same stable finding disappears in a fresh LektaResult -> VERIFIED_FIXED.
  await page.goto(`${KATEDRA_URL}/${handoffFragment(result(projectId, 'e2e-analysis-3', []))}`, {
    waitUntil: 'domcontentloaded',
  })
  state = await waitManifest(
    page,
    m => m.lektaIssues?.length === 0 && m.lektaResolutionHistory?.length >= 1,
    'VERIFIED_FIXED history',
  )
  const verification = state.lektaResolutionHistory.at(-1)
  assert.equal(verification.issueId, 'rule:e2e.margins.001')
  assert.equal(verification.checkId, 'margins')
  assert.equal(verification.ruleId, 'e2e.margins.001')
  assert.equal(verification.status, 'VERIFIED_FIXED')
  assert.equal(verification.analysisId, 'e2e-analysis-3')
  assert.ok((state.lektaFixedTotal || 0) >= 1)

  if (browserErrors.length) throw new Error(`Browser page errors:\n${browserErrors.join('\n')}`)

  console.log('ACADEMIC_SUITE_BROWSER_E2E_PASS')
  console.log(JSON.stringify({ projectId, verifiedIssue: verification.issueId }, null, 2))
} finally {
  await browser.close()
}
