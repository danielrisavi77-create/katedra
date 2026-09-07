import assert from 'node:assert/strict'

// Local browser fixtures only; this does not verify server authorization or staging.
const baseUrl = String(process.env.KATEDRA_INTEGRATION_URL || 'http://localhost:3000').replace(/\/$/u, '')
const target = new URL(baseUrl)
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Use a localhost integration URL')
const projectId = 'plan-approval-ui-smoke-project'
const runId = 'plan-approval-ui-smoke-run'
const planRevision = 'a'.repeat(64)
const review = {
  ready: true, approved: false, planRevision,
  sectionTitles: { theory: 'Teorijski okvir' },
  sourceLabels: { source: 'Autor Primjer, Provjereni izvor, 2026' },
  plan: {
    thesis: 'Sudjelovanje doprinosi legitimnosti javnih odluka.',
    question: 'Kako sudjelovanje utječe na legitimnost?',
    perspectives: [
      { label: 'Institucionalna perspektiva', position: 'Pravila potiču sudjelovanje.', why: 'Usporedba institucionalnih uvjeta.' },
      { label: 'Perspektiva građana', position: 'Povjerenje oblikuje sudjelovanje.', why: 'Usporedba iskustava građana.' },
    ],
    chapters: [{ sectionId: 'theory', pages: 6, content: 'Usporediti pojmove sudjelovanja i legitimnosti.', sources: ['source'] }],
  },
}
const { chromium } = await import('playwright')
const browser = await chromium.launch({ headless: true })

async function scenario(width, alreadyApproved) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await context.newPage()
  const pageErrors = []
  const unexpectedRequests = []
  const actions = []
  let resumed = false
  let mockedFeatureDocuments = 0
  page.on('pageerror', (error) => pageErrors.push(String(error)))
  try {
    await context.addInitScript(({ projectId, runId }) => {
      localStorage.setItem('rp_manifest', JSON.stringify({ v: 1, projectId, topic: 'Lokalna provjera odobrenja plana', workType: 'z', institution: 'Fakultet političkih znanosti', program: 'Politologija' }))
      localStorage.setItem('katedra_project_setup_v1:' + projectId, '1')
      localStorage.setItem('katedra_agent_run_v1:' + projectId, runId)
      localStorage.setItem('katedra_project_mode_v1:' + projectId, 'autonomous')
      localStorage.removeItem('katedra_workspace_view_v2:' + projectId)
      // Exercise the real AuthProvider using its existing browser client seam.
      // No credential, cookie, or authenticated server session is created.
      const session = { user: { id: 'ui-fixture-user', email: 'fixture@example.invalid' } }
      globalThis.__supabaseBrowserClient = { auth: {
        getSession: async () => ({ data: { session }, error: null }),
        onAuthStateChange: (callback) => {
          let subscribed = true
          queueMicrotask(() => { if (subscribed) callback('INITIAL_SESSION', session) })
          return { data: { subscription: { unsubscribe: () => { subscribed = false } } } }
        },
      } }
    }, { projectId, runId })
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin !== target.origin) return route.abort()
      if (url.pathname === '/pisi' && request.isNavigationRequest()) {
        // Mock only the browser's serialized UI prop. Server flags remain disabled.
        const response = await route.fetch()
        const html = await response.text()
        const fixtureHtml = html.replace(/\\"agenticAvailable\\":false/g, '\\"agenticAvailable\\":true')
        assert.notEqual(fixtureHtml, html, 'Expected disabled agenticAvailable UI prop in local HTML fixture')
        mockedFeatureDocuments += 1
        return route.fulfill({ response, body: fixtureHtml })
      }
      if (!url.pathname.startsWith('/api/')) return route.continue()
      const method = request.method()
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(body) })
      if (url.pathname === '/api/state' && method === 'PUT') return json({ projectId })
      if (url.pathname === '/api/state' && method === 'GET') return json({})
      if (url.pathname === '/api/materials' && method === 'GET') return json({ materials: [] })
      if (url.pathname === '/api/balance' && method === 'GET') return json({ hasPass: true, adminOverride: false, balance: 0 })
      if (url.pathname === '/api/agent-runs' && method === 'GET') return json({ runs: [{ run_id: runId, project_id: projectId, status: 'blocked' }] })
      if (url.pathname === '/api/agent-runs/' + runId && method === 'GET') return json({
        run: { run_id: runId, project_id: projectId, status: resumed ? 'running' : 'blocked', mode: 'guided' },
        steps: [
          { step_id: 'planning', agent: 'planning', verifier: 'planning_verifier', status: 'verified', attempt: 1 },
          { step_id: 'writing', agent: 'writing', verifier: 'writing_verifier', status: resumed ? 'running' : 'blocked', attempt: 1,
            last_verification: { issues: [{ code: 'gate_finding', message: alreadyApproved ? 'Provjeri potporu navedenom izvoru.' : 'Pregledaj i izričito odobri plan prije nastavka pisanja.' }] } },
        ], results: [],
      })
      if (url.pathname === '/api/agent-runs/' + runId + '/plan-approval' && method === 'GET') return json({ ...review, approved: alreadyApproved })
      if (url.pathname === '/api/agent-runs/' + runId + '/plan-approval' && method === 'POST') {
        actions.push({ action: 'approve', body: request.postDataJSON() })
        return json({ approved: true, planRevision })
      }
      if (url.pathname === '/api/agent-runs/' + runId + '/resume' && method === 'POST') {
        actions.push({ action: 'resume', body: request.postDataJSON() })
        resumed = true
        return json({ runId, status: 'running' })
      }
      unexpectedRequests.push(method + ' ' + url.pathname)
      return json({ error: 'Unmocked local UI smoke request' }, 503)
    })
    await page.goto(baseUrl + '/pisi?projectId=' + encodeURIComponent(projectId), { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Tijek izrade rada', exact: true }).waitFor({ timeout: 20_000 })
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 })
    const approveButton = page.getByRole('button', { name: 'Odobri plan i nastavi', exact: true })
    if (alreadyApproved) {
      await page.getByText('Plan je odobren.', { exact: true }).waitFor()
      assert.equal(await approveButton.count(), 0, 'Already-approved plans must not request another approval')
      assert.deepEqual(actions, [], 'Already-approved rendering must not mutate the run')
    } else {
      await page.getByRole('heading', { name: 'Pregledaj i odobri plan', exact: true }).waitFor()
      const card = page.locator('section[aria-labelledby="agent-plan-approval-title"]')
      await card.getByText(review.plan.thesis, { exact: false }).waitFor()
      for (const text of [review.plan.question, 'Institucionalna perspektiva', 'Perspektiva građana', 'Teorijski okvir', review.plan.chapters[0].content, review.sourceLabels.source]) {
        assert.ok((await card.innerText()).includes(text), 'Readable plan missing: ' + text)
      }
      const previewDimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
      assert.ok(previewDimensions.scroll <= previewDimensions.width + 1, 'Approval preview overflows at ' + width + 'px')
      assert.deepEqual(actions, [], 'Displaying a plan must not approve or resume it')
      assert.equal(await approveButton.isEnabled(), true)
      await approveButton.click()
      await page.getByRole('button', { name: 'Pauziraj tijek', exact: true }).waitFor()
      assert.deepEqual(actions, [
        { action: 'approve', body: { projectId, planRevision, approve: true } },
        { action: 'resume', body: { projectId } },
      ], 'Explicit approval must precede resume exactly once')
    }
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
    assert.ok(dimensions.scroll <= dimensions.width + 1, 'Horizontal overflow at ' + width + 'px: ' + JSON.stringify(dimensions))
    assert.equal(mockedFeatureDocuments, 1, 'Exactly one browser document must use the explicit UI feature fixture')
    assert.deepEqual(unexpectedRequests, [], 'Unexpected API request escaped the fixture contract')
    assert.deepEqual(pageErrors, [], 'Browser runtime errors')
    console.log('AGENT_PLAN_APPROVAL_UI_SCENARIO_PASS width=' + width + ' approved=' + alreadyApproved)
  } finally {
    await context.close()
  }
}

try {
  for (const width of [390, 1440]) {
    await scenario(width, false)
    await scenario(width, true)
  }
  console.log('AGENT_PLAN_APPROVAL_UI_SMOKE_PASS (localhost mocked UI feature prop and API/auth fixtures; not staging verification)')
} catch (error) {
  console.error('AGENT_PLAN_APPROVAL_UI_SMOKE_FAIL: ' + (error instanceof Error ? error.stack : String(error)))
  process.exitCode = 1
} finally {
  await browser.close()
}
