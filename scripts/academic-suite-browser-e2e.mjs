import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const KATEDRA_URL = String(process.env.KATEDRA_E2E_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const LEKTA_PREVIEW_URL = String(process.env.LEKTA_PREVIEW_URL || '').replace(/\/$/, '')
const E2E_DOCX_PATH = String(process.env.E2E_DOCX_PATH || '')

if (!LEKTA_PREVIEW_URL) throw new Error('LEKTA_PREVIEW_URL is required')
if (!E2E_DOCX_PATH) throw new Error('E2E_DOCX_PATH is required')

function handoffFragment(value) {
  return `#lekta=${encodeURIComponent(Buffer.from(JSON.stringify(value), 'utf8').toString('base64'))}`
}

function decodeHandoffHref(href) {
  const url = new URL(href)
  if (!url.hash.startsWith('#lekta=')) throw new Error(`Missing #lekta= fragment: ${href}`)
  const encoded = decodeURIComponent(url.hash.slice('#lekta='.length))
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
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
page.on('pageerror', error => browserErrors.push(`Katedra: ${String(error)}`))

try {
  await page.goto(`${KATEDRA_URL}/`, { waitUntil: 'domcontentloaded' })
  const initial = await waitManifest(page, m => typeof m.projectId === 'string' && m.projectId.length > 10, 'guest projectId')
  const projectId = initial.projectId
  assert.ok(projectId)
  await completeOnboarding(page)

  const lektaPage = await context.newPage()
  lektaPage.on('pageerror', error => browserErrors.push(`Lekta routing: ${String(error)}`))
  const previewEntry = `${LEKTA_PREVIEW_URL}/?project=${encodeURIComponent(projectId)}&unit=fpzg&work=diplomski`
  await lektaPage.goto(previewEntry, { waitUntil: 'domcontentloaded' })
  await lektaPage.waitForFunction(expected => sessionStorage.getItem('lekta.katedra-project.v0.1') === expected, projectId)

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

  await page.goto(`${KATEDRA_URL}/${handoffFragment(result(projectId, 'e2e-analysis-1', [stableMarginIssue]))}`, { waitUntil: 'domcontentloaded' })
  let state = await waitManifest(page, m => m.lektaIssues?.length === 1 && m.lektaIssues[0].id === 'rule:e2e.margins.001', 'first OPEN issue')
  assert.equal(state.lektaIssues[0].status, 'OPEN')
  assert.equal(state.lektaIdentityIndex?.['rule:e2e.margins.001']?.checkId, 'margins')
  assert.equal(state.lektaIdentityIndex?.['rule:e2e.margins.001']?.ruleId, 'e2e.margins.001')

  await startResolutionRound(page)
  const solved = page.getByRole('button', { name: /Riješio sam/i }).first()
  await solved.waitFor({ state: 'visible' })
  await solved.click()
  state = await waitManifest(page, m => m.lektaIssues?.[0]?.status === 'USER_CHANGED', 'USER_CHANGED')
  assert.equal(state.lektaIssues[0].status, 'USER_CHANGED')

  const recheck = page.getByRole('link', { name: /Ponovi Lekta Check/i }).first()
  await recheck.waitFor({ state: 'visible' })
  const recheckHref = await recheck.getAttribute('href')
  assert.ok(recheckHref?.includes(`project=${encodeURIComponent(projectId)}`), 're-check link must carry projectId')
  await clickWithoutNavigation(page, recheck)
  state = await waitManifest(page, m => m.lektaIssues?.[0]?.status === 'RECHECK_REQUIRED', 'RECHECK_REQUIRED')
  assert.equal(state.lektaIssues[0].status, 'RECHECK_REQUIRED')

  await page.goto(`${KATEDRA_URL}/${handoffFragment(result(projectId, 'e2e-analysis-2', [stableMarginIssue]))}`, { waitUntil: 'domcontentloaded' })
  state = await waitManifest(page, m => m.lektaIssues?.length === 1 && m.lektaIssues[0].status === 'OPEN', 'persistent finding reopened')
  assert.equal(state.lektaIssues[0].id, 'rule:e2e.margins.001')
  assert.equal(state.lektaResolutionHistory?.length || 0, 0)

  await startResolutionRound(page)
  const solvedAgain = page.getByRole('button', { name: /Riješio sam/i }).first()
  await solvedAgain.waitFor({ state: 'visible' })
  await solvedAgain.click()
  const recheckAgain = page.getByRole('link', { name: /Ponovi Lekta Check/i }).first()
  await recheckAgain.waitFor({ state: 'visible' })
  await clickWithoutNavigation(page, recheckAgain)
  await waitManifest(page, m => m.lektaIssues?.[0]?.status === 'RECHECK_REQUIRED', 'second RECHECK_REQUIRED')

  await page.goto(`${KATEDRA_URL}/${handoffFragment(result(projectId, 'e2e-analysis-3', []))}`, { waitUntil: 'domcontentloaded' })
  state = await waitManifest(page, m => m.lektaIssues?.length === 0 && m.lektaResolutionHistory?.length >= 1, 'VERIFIED_FIXED history')
  const verification = state.lektaResolutionHistory.at(-1)
  assert.equal(verification.issueId, 'rule:e2e.margins.001')
  assert.equal(verification.checkId, 'margins')
  assert.equal(verification.ruleId, 'e2e.margins.001')
  assert.equal(verification.status, 'VERIFIED_FIXED')
  assert.equal(verification.analysisId, 'e2e-analysis-3')
  assert.ok((state.lektaFixedTotal || 0) >= 1)

  // Real DOCX through the actual deployed Lekta preview and its real local analyzer.
  const realLekta = await context.newPage()
  realLekta.on('pageerror', error => browserErrors.push(`Lekta DOCX: ${String(error)}`))
  await realLekta.goto(previewEntry, { waitUntil: 'domcontentloaded' })
  await realLekta.waitForFunction(expected => sessionStorage.getItem('lekta.katedra-project.v0.1') === expected, projectId)
  await realLekta.locator('#fileInput').setInputFiles(E2E_DOCX_PATH)

  // `setFile()` deliberately advances the wizard to Profile (step 2). Follow
  // the same real user control that confirms the profile and opens step 3.
  const toAnalyzeStep = realLekta.locator('#stepToAnalyze')
  await toAnalyzeStep.waitFor({ state: 'visible', timeout: 20_000 })
  await toAnalyzeStep.click()
  await realLekta.waitForFunction(() => document.querySelector('#wizardView')?.dataset.step === '3')

  const analyze = realLekta.locator('#analyzeBtn')
  await analyze.waitFor({ state: 'visible', timeout: 20_000 })
  await realLekta.waitForFunction(() => {
    const button = document.querySelector('#analyzeBtn')
    return button && !button.disabled
  }, null, { timeout: 20_000 })
  await analyze.click()

  const realCta = realLekta.locator('#katedraHandoffStrip [data-katedra-handoff]')
  await realCta.waitFor({ state: 'visible', timeout: 45_000 })
  const actualHref = await realCta.getAttribute('href')
  assert.ok(actualHref, 'real Lekta analysis must render Katedra CTA')
  const actualResult = decodeHandoffHref(actualHref)

  assert.equal(actualResult.schemaVersion, '0.1')
  assert.equal(actualResult.projectId, projectId)
  assert.ok(typeof actualResult.analysisId === 'string' && actualResult.analysisId.length > 0)
  assert.ok(Array.isArray(actualResult.issues) && actualResult.issues.length > 0, 'bad-format DOCX must produce findings')
  for (const issue of actualResult.issues) {
    assert.ok(typeof issue.issueKey === 'string' && (issue.issueKey.startsWith('rule:') || issue.issueKey.startsWith('check:')))
    assert.ok(typeof issue.checkId === 'string' && issue.checkId.length > 0)
    assert.equal(Object.hasOwn(issue, 'detail'), false, 'handoff must not contain document-derived detail')
    assert.equal(Object.hasOwn(issue, 'location'), false, 'handoff must not contain document-derived location')
  }
  const actualJson = JSON.stringify(actualResult)
  assert.equal(actualJson.includes('Ovaj sintetski dokument služi isključivo automatiziranom testu'), false)
  assert.equal(actualJson.includes('Tekst je namjerno oblikovan fontom Arial 11'), false)

  const actualHash = new URL(actualHref).hash
  await realLekta.close()
  await page.goto(`${KATEDRA_URL}/${actualHash}`, { waitUntil: 'domcontentloaded' })
  const firstActualIssue = actualResult.issues[0]
  state = await waitManifest(page, m => m.lektaIssues?.some(issue => issue.id === firstActualIssue.issueKey), 'real DOCX LektaResult ingested by Katedra', 20_000)
  assert.equal(state.lektaIdentityIndex?.[firstActualIssue.issueKey]?.checkId, firstActualIssue.checkId)
  assert.equal(state.projectId, projectId)

  if (browserErrors.length) throw new Error(`Browser page errors:\n${browserErrors.join('\n')}`)

  console.log('ACADEMIC_SUITE_BROWSER_E2E_PASS')
  console.log(JSON.stringify({
    projectId,
    verifiedIssue: verification.issueId,
    realDocxAnalysisId: actualResult.analysisId,
    realDocxIssueCount: actualResult.issues.length,
    realDocxFirstIssue: firstActualIssue.issueKey,
  }, null, 2))
} finally {
  await browser.close()
}
