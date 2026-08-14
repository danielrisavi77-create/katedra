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

async function completeOnboarding(page) {
  const newWork = page.getByRole('button', { name: /Novi rad/i })
  if (!(await newWork.isVisible().catch(() => false))) return
  await newWork.click()
  await page.getByLabel(/Fakultet ili ustanova/i).fill('FPZG')
  await page.getByRole('button', { name: /Dalje/i }).click()
  await page.getByLabel(/Tema rada/i).fill('Automatizirani E2E rukopis')
  await page.getByRole('button', { name: /Otvori rukopis/i }).click()
  await page.getByRole('main').waitFor({ state: 'visible' })
}

async function lektaWizardSnapshot(page) {
  return page.evaluate(() => {
    const wizard = document.querySelector('#wizardView')
    const form = document.querySelector('.lek-col-form')
    const fileInput = document.querySelector('#fileInput')
    const selectedName = document.querySelector('#selectedName')
    const selectedFile = document.querySelector('#selectedFile')
    const dropzone = document.querySelector('#dropzone')
    const dropError = document.querySelector('#dropError')
    const next = document.querySelector('#stepToAnalyze')
    const analyze = document.querySelector('#analyzeBtn')
    const detectBadge = document.querySelector('#detectBadge')
    const profileNote = document.querySelector('#profileNote')
    return {
      wizardStep: wizard?.dataset?.step || null,
      formClass: form?.className || null,
      fileCount: fileInput?.files?.length || 0,
      selectedName: selectedName?.textContent || null,
      selectedFileDisplay: selectedFile ? getComputedStyle(selectedFile).display : null,
      dropzoneClass: dropzone?.className || null,
      dropError: dropError?.textContent?.trim() || null,
      dropErrorDisplay: dropError ? getComputedStyle(dropError).display : null,
      nextDisplay: next ? getComputedStyle(next).display : null,
      nextVisibility: next ? getComputedStyle(next).visibility : null,
      analyzeDisplay: analyze ? getComputedStyle(analyze).display : null,
      analyzeDisabled: analyze?.disabled ?? null,
      detectBadge: detectBadge?.textContent?.trim() || null,
      profileNote: profileNote?.textContent?.trim().slice(0, 300) || null,
      unit: document.querySelector('#unitSelect')?.value || null,
      workType: document.querySelector('#workType')?.value || null,
    }
  })
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()
const browserErrors = []
page.on('pageerror', error => browserErrors.push(`Katedra: ${String(error)}`))

try {
  await page.goto(`${KATEDRA_URL}/pisi?tip=d`, { waitUntil: 'domcontentloaded' })
  await completeOnboarding(page)
  const initial = await waitManifest(page, m => typeof m.projectId === 'string' && m.projectId.length > 10, 'guest projectId')
  const projectId = initial.projectId
  assert.ok(projectId)

  const editor = page.locator('.pis-prosemirror')
  await editor.click()
  await editor.fill('Ovo je lokalno spremljen E2E odlomak rukopisa.')
  await page.waitForTimeout(700)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('main').waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.querySelector('.pis-prosemirror')?.textContent?.includes('lokalno spremljen E2E'))

  // Local-first manuscript contract: a JSON backup must be downloadable and
  // restorable without sending the document body to /api/state.
  await page.getByRole('button', { name: 'Projekt' }).click()
  const backupDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: /Spremi lokalni backup/i }).click()
  const backupPath = await (await backupDownload).path()
  assert.ok(backupPath, 'manuscript backup must produce a downloadable file')
  await page.getByRole('button', { name: /Zatvori projektne alate/i }).click()
  await editor.fill('Ovo je privremena izmjena koja se mora moći vratiti iz backupa.')
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: 'Projekt' }).click()
  const restoreInput = page.locator('label').filter({ hasText: /Vrati backup/i }).locator('input[type="file"]')
  await restoreInput.setInputFiles(backupPath)
  await page.waitForFunction(() => document.querySelector('.pis-prosemirror')?.textContent?.includes('lokalno spremljen E2E'))
  await page.getByRole('button', { name: /Zatvori projektne alate/i }).click()

  // Theme and responsive smoke checks protect the writing surface from
  // regressions that are easy to miss in a desktop-only happy path.
  const themeToggle = page.getByRole('button', { name: /tamnu temu/i })
  await themeToggle.click()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('navigation', { name: 'Radni prostor' }).waitFor({ state: 'visible' })
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(mobileOverflow <= 1, `mobile layout overflows horizontally by ${mobileOverflow}px`)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: /svijetlu temu/i }).click()

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

  await page.goto(`${KATEDRA_URL}/pisi${handoffFragment(result(projectId, 'e2e-analysis-1', [stableMarginIssue]))}`, { waitUntil: 'domcontentloaded' })
  let state = await waitManifest(page, m => m.lektaIssues?.length === 1 && m.lektaIssues[0].id === 'rule:e2e.margins.001', 'first OPEN issue')
  assert.equal(state.lektaIssues[0].status, 'OPEN')
  assert.equal(state.lektaIdentityIndex?.['rule:e2e.margins.001']?.checkId, 'margins')
  assert.equal(state.lektaIdentityIndex?.['rule:e2e.margins.001']?.ruleId, 'e2e.margins.001')

  await page.getByRole('button', { name: 'Projekt' }).click()
  await page.getByRole('button', { name: 'Lekta' }).click()
  await page.getByText(/margine odstupaju/i).waitFor({ state: 'visible' })
  const recheck = page.getByRole('link', { name: /Otvori projekt u Lekti/i })
  const recheckHref = await recheck.getAttribute('href')
  assert.ok(recheckHref?.includes(`project=${encodeURIComponent(projectId)}`), 'Lekta link must carry projectId')

  // Real DOCX through the actual deployed Lekta preview and its real local analyzer.
  const realLekta = await context.newPage()
  realLekta.on('pageerror', error => browserErrors.push(`Lekta DOCX: ${String(error)}`))
  await realLekta.goto(previewEntry, { waitUntil: 'domcontentloaded' })
  await realLekta.waitForFunction(expected => sessionStorage.getItem('lekta.katedra-project.v0.1') === expected, projectId)

  const fileChooserPromise = realLekta.waitForEvent('filechooser')
  await realLekta.locator('#paperCoverBtn').click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(E2E_DOCX_PATH)

  // Wait for either a valid transition into the profile wizard or an explicit
  // intake error. If neither happens, emit the full runtime snapshot rather
  // than hiding the cause behind a generic Playwright visibility timeout.
  await realLekta.waitForFunction(() => {
    const wizard = document.querySelector('#wizardView')
    const error = document.querySelector('#dropError')
    return wizard?.dataset?.step === '2' || Boolean(error?.textContent?.trim())
  }, null, { timeout: 20_000 }).catch(() => {})

  const uploadSnapshot = await lektaWizardSnapshot(realLekta)
  console.log('LEKTA_REAL_DOCX_UPLOAD_STATE', JSON.stringify(uploadSnapshot))
  assert.equal(uploadSnapshot.fileCount, 1, `Lekta file chooser did not retain DOCX: ${JSON.stringify(uploadSnapshot)}`)
  assert.equal(uploadSnapshot.wizardStep, '2', `Lekta did not advance to profile step: ${JSON.stringify(uploadSnapshot)}`)
  assert.ok(String(uploadSnapshot.formClass || '').includes('lek-engaged'), `Lekta analyzer form was not engaged: ${JSON.stringify(uploadSnapshot)}`)
  assert.equal(uploadSnapshot.dropError, null, `Lekta intake rejected E2E DOCX: ${JSON.stringify(uploadSnapshot)}`)

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
  await page.goto(`${KATEDRA_URL}/pisi${actualHash}`, { waitUntil: 'domcontentloaded' })
  const firstActualIssue = actualResult.issues[0]
  state = await waitManifest(page, m => m.lektaIssues?.some(issue => issue.id === firstActualIssue.issueKey), 'real DOCX LektaResult ingested by Katedra', 20_000)
  assert.equal(state.lektaIdentityIndex?.[firstActualIssue.issueKey]?.checkId, firstActualIssue.checkId)
  assert.equal(state.projectId, projectId)

  if (browserErrors.length) throw new Error(`Browser page errors:\n${browserErrors.join('\n')}`)

  console.log('ACADEMIC_SUITE_BROWSER_E2E_PASS')
  console.log(JSON.stringify({
    projectId,
    displayedIssue: 'rule:e2e.margins.001',
    realDocxAnalysisId: actualResult.analysisId,
    realDocxIssueCount: actualResult.issues.length,
    realDocxFirstIssue: firstActualIssue.issueKey,
  }, null, 2))
} finally {
  await browser.close()
}
