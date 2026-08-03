import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const KATEDRA_URL = String(process.env.KATEDRA_E2E_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const LEKTA_PREVIEW_URL = String(process.env.LEKTA_PREVIEW_URL || '').replace(/\/$/, '')

if (!LEKTA_PREVIEW_URL) {
  throw new Error('LEKTA_PREVIEW_URL is required')
}

function handoffFragment(result) {
  const base64 = Buffer.from(JSON.stringify(result), 'utf8').toString('base64')
  return `#lekta=${encodeURIComponent(base64)}`
}

function result(projectId, analysisId, issues) {
  return {
    schemaVersion: '0.1',
    analysisId,
    projectId,
    rulesetId: 'e2e:fpzg-graduate:v1',
    profileId: 'fpzg-e2e-graduate',
    score: issues.length ? 82 : 100,
    scoreLabel: issues.length ? 'Potrebne su dorade' : 'Visoka usklađenost s profilom',
    profileStatus: 'verified',
    categoryScores: [],
    issues,
    analyzedAt: new Date().toISOString(),
  }
}

const stableMarginIssue = {
  issueKey: 'rule:e2e.margins.001',
  checkId: 'margins',
  ruleId: 'e2e.margins.001',
  category: 'formatting',
  severity: 'warning',
  summary: 'E2E: margine odstupaju od profila',
  fixable: true,
  fixerId: 'margins-fixer',
  status: 'OPEN',
}

async function manifest(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('rp_manifest') || 'null'))
}

async function waitManifest(page, predicateSource) {
  await page.waitForFunction(
    source => {
      const value = JSON.parse(localStorage.getItem('rp_manifest') || 'null')
      if (!value) return false
      // The source is authored below and contains no untrusted input.
      return Function('m', `return (${source})(m)`)(value)
    },
    predicateSource,
  )
  return manifest(page)
}

async function clickWithoutNavigation(page, locator) {
  await page.evaluate(() => {
    document.addEventListener('click', event => event.preventDefault(), { once: true })
  })
  await locator.click()
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

const browserErrors = []
page.on('pageerror', error => browserErrors.push(String(error)))

try {
  // A. Real Katedra guest project identity.
  await page.goto(`${KATEDRA_URL}/`, { waitUntil: 'domcontentloaded' })
  const initial = await waitManifest(page, 'm => typeof m.projectId === "string" && m.projectId.length > 10')
  const projectId = initial.projectId
  assert.ok(projectId, 'Katedra must create a guest projectId before auth')

  // B. Real Lekta PR preview must accept Katedra routing metadata and remember
  // the project only for that Katedra-origin browser tab.
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

  // C. First canonical LektaResult arrives in Katedra: OPEN.
  const first = result(projectId, 'e2e-analysis-1', [stableMarginIssue])
  await page.goto(`${KATEDRA_URL}/${handoffFragment(first)}`, { waitUntil: 'domcontentloaded' })
  let state = await waitManifest(page, 'm => m.lektaIssues?.length === 1 && m.lektaIssues[0].id === "rule:e2e.margins.001"')
  assert.equal(state.lektaIssues[0].status, 'OPEN')
  assert.equal(state.lektaIdentityIndex?.['rule:e2e.margins.001']?.checkId, 'margins')
  assert.equal(state.lektaIdentityIndex?.['rule:e2e.margins.001']?.ruleId, 'e2e.margins.001')

  // D. User says they changed it. Katedra may record USER_CHANGED, not verify.
  const solved = page.getByRole('button', { name: /Riješio sam/i }).first()
  await solved.waitFor({ state: 'visible' })
  await solved.click()
  state = await waitManifest(page, 'm => m.lektaIssues?.[0]?.status === "USER_CHANGED"')
  assert.equal(state.lektaIssues[0].status, 'USER_CHANGED')

  // E. Only an actual project-bound re-check transition may advance the state.
  const recheck = page.getByRole('link', { name: /Ponovi Lekta Check/i }).first()
  await recheck.waitFor({ state: 'visible' })
  const recheckHref = await recheck.getAttribute('href')
  assert.ok(recheckHref?.includes(`project=${encodeURIComponent(projectId)}`), 're-check link must carry canonical projectId')
  await clickWithoutNavigation(page, recheck)
  state = await waitManifest(page, 'm => m.lektaIssues?.[0]?.status === "RECHECK_REQUIRED"')
  assert.equal(state.lektaIssues[0].status, 'RECHECK_REQUIRED')

  // F. Finding persists in fresh analysis -> it reopens, never falsely verifies.
  const persists = result(projectId, 'e2e-analysis-2', [stableMarginIssue])
  await page.goto(`${KATEDRA_URL}/${handoffFragment(persists)}`, { waitUntil: 'domcontentloaded' })
  state = await waitManifest(page, 'm => m.lektaIssues?.length === 1 && m.lektaIssues[0].status === "OPEN"')
  assert.equal(state.lektaIssues[0].id, 'rule:e2e.margins.001')
  assert.equal(state.lektaResolutionHistory?.length || 0, 0)

  // G. User changes it again and starts a real re-check.
  const solvedAgain = page.getByRole('button', { name: /Riješio sam/i }).first()
  await solvedAgain.waitFor({ state: 'visible' })
  await solvedAgain.click()
  const recheckAgain = page.getByRole('link', { name: /Ponovi Lekta Check/i }).first()
  await recheckAgain.waitFor({ state: 'visible' })
  await clickWithoutNavigation(page, recheckAgain)
  await waitManifest(page, 'm => m.lektaIssues?.[0]?.status === "RECHECK_REQUIRED"')

  // H. Same stable finding disappears in fresh LektaResult -> VERIFIED_FIXED.
  const fixed = result(projectId, 'e2e-analysis-3', [])
  await page.goto(`${KATEDRA_URL}/${handoffFragment(fixed)}`, { waitUntil: 'domcontentloaded' })
  state = await waitManifest(page, 'm => m.lektaIssues?.length === 0 && m.lektaResolutionHistory?.length >= 1')
  const verification = state.lektaResolutionHistory.at(-1)
  assert.equal(verification.issueId, 'rule:e2e.margins.001')
  assert.equal(verification.checkId, 'margins')
  assert.equal(verification.ruleId, 'e2e.margins.001')
  assert.equal(verification.status, 'VERIFIED_FIXED')
  assert.equal(verification.analysisId, 'e2e-analysis-3')
  assert.ok((state.lektaFixedTotal || 0) >= 1)

  if (browserErrors.length) {
    throw new Error(`Browser page errors:\n${browserErrors.join('\n')}`)
  }

  console.log('ACADEMIC_SUITE_BROWSER_E2E_PASS')
  console.log(JSON.stringify({ projectId, verifiedIssue: verification.issueId }, null, 2))
} finally {
  await browser.close()
}
