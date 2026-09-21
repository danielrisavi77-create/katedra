import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createManuscript } from '@/lib/manuscript/model'

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), loadActiveRunContextSnapshot: vi.fn(), loadAgentRunResults: vi.fn(), storePlanApproval: vi.fn(), readProjectLock: vi.fn(), lookupActiveProjectPassForProduct: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/agents/run-context-access', () => ({ loadActiveRunContextSnapshot: mocks.loadActiveRunContextSnapshot }))
vi.mock('@/lib/agents/run-context-loader', () => ({ createSupabaseRunPayloadManifestStore: vi.fn(() => ({})) }))
vi.mock('@/lib/agents/run-result-storage', () => ({ loadAgentRunResults: mocks.loadAgentRunResults }))
vi.mock('@/lib/agents/run-context-storage', () => ({ storePlanApproval: mocks.storePlanApproval }))
vi.mock('@/lib/academic-suite/project-lock', () => ({ readProjectLock: mocks.readProjectLock, validateLockedProjectMutation: vi.fn(() => ({ ok: true })) }))
vi.mock('@/lib/academic-suite/repositories/entitlements', () => ({ lookupActiveProjectPassForProduct: mocks.lookupActiveProjectPassForProduct }))
import { GET, POST } from './[runId]/plan-approval/route'

const manuscript = createManuscript({ projectId: 'project-1', title: 'Topic', workType: 's' })
const output = '<!-- PLAN:JSON -->{"thesis":"Thesis","chapters":[{"sectionId":"chapter-1","content":"Program","sources":["source-1"]}]}<!-- /PLAN:JSON -->'
const saved = { materialId: 'planning-1', stepId: 'planning', agent: 'planning', verifier: 'planning_verifier', stepOrder: 3, attempt: 1, runId: 'run-1', projectId: 'project-1', output, citations: [], verification: { status: 'verified', issues: [], evidence: [] }, createdAt: '2026-09-07T00:00:00Z' }
let run, user, query
const params = { params: { runId: 'run-1' } }
function request(body, origin = 'http://localhost') { return new Request('http://localhost/api/agent-runs/run-1/plan-approval', { method: body ? 'POST' : 'GET', headers: { origin, 'content-type': 'application/json', 'x-request-id': 'approval-test' }, ...(body ? { body: JSON.stringify(body) } : {}) }) }
async function preview() { return (await GET(request(), params)).json() }

beforeEach(() => {
  vi.stubEnv('KATEDRA_AGENT_RUNS_ENABLED', 'true')
  run = { run_id: 'run-1', project_id: 'project-1', status: 'blocked' }
  user = { id: 'user-1' }
  query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: vi.fn(async () => ({ data: run, error: null })) }
  mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user } }) }, from: () => query, storage: { from: () => ({ download: vi.fn() }) } })
  mocks.loadActiveRunContextSnapshot.mockResolvedValue({ manuscript, contextRevision: 'context-1' })
  mocks.loadAgentRunResults.mockResolvedValue([saved])
  mocks.readProjectLock.mockResolvedValue({ ok: true, lock: { workType: 's', productKey: 'seminarski' } })
  mocks.lookupActiveProjectPassForProduct.mockResolvedValue({ ok: true, active: true })
  mocks.storePlanApproval.mockResolvedValue({ ok: true, value: { manifestId: 'context' } })
})
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs() })

describe('explicit plan approval API', () => {
  it.each(['GET', 'POST'])('rejects expired or revoked context in %s without granting approval', async (method) => {
    mocks.loadActiveRunContextSnapshot.mockRejectedValueOnce(new Error('Context expired'))
    const response = method === 'GET' ? await GET(request(), params)
      : await POST(request({ approve: true, projectId: 'project-1', planRevision: 'a'.repeat(64) }), params)
    expect(response.status).toBe(503)
    expect(mocks.storePlanApproval).not.toHaveBeenCalled()
    expect(mocks.loadAgentRunResults).not.toHaveBeenCalled()
  })
  it('GET previews a verified plan without recording approval', async () => {
    const response = await GET(request(), params)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('x-request-id')).toBe('approval-test')
    expect(await response.json()).toMatchObject({ ready: true, approved: false, plan: { thesis: 'Thesis' } })
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mocks.storePlanApproval).not.toHaveBeenCalled()
  })
  it('stamps the authenticated owner and current revision, ignoring client approval metadata', async () => {
    const review = await preview()
    const response = await POST(request({ approve: true, projectId: 'project-1', planRevision: review.planRevision, approvedBy: 'attacker', approvedAt: '1900' }), params)
    expect(response.status).toBe(200)
    const stored = mocks.storePlanApproval.mock.calls[0][1]
    expect(stored).toMatchObject({ userId: 'user-1', contextRevision: 'context-1', planApproval: { schemaVersion: 1, runId: 'run-1', projectId: 'project-1', approvedBy: 'user-1', planRevision: review.planRevision } })
    expect(Date.parse(stored.planApproval.approvedAt)).toBeGreaterThan(Date.parse('2026-01-01'))
    expect(mocks.lookupActiveProjectPassForProduct).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1', projectId: 'project-1', productId: 'katedra_pass_seminarski' })
  })
  it('rejects a plan changed between display and confirmation', async () => {
    const review = await preview()
    mocks.loadAgentRunResults.mockResolvedValue([{ ...saved, output: output.replace('Program', 'Changed') }])
    expect((await POST(request({ approve: true, projectId: 'project-1', planRevision: review.planRevision }), params)).status).toBe(409)
    expect(mocks.storePlanApproval).not.toHaveBeenCalled()
  })
  it.each(['unauthenticated', 'foreign-run', 'wrong-project', 'cross-origin', 'running', 'no-pass', 'implicit'])('rejects %s confirmation without storage mutation', async (scenario) => {
    const review = await preview()
    const body = { approve: true, projectId: 'project-1', planRevision: review.planRevision }
    let origin = 'http://localhost'
    if (scenario === 'unauthenticated') user = null
    if (scenario === 'foreign-run') run = null
    if (scenario === 'wrong-project') body.projectId = 'foreign'
    if (scenario === 'cross-origin') origin = 'https://attacker.example'
    if (scenario === 'running') run.status = 'running'
    if (scenario === 'no-pass') mocks.lookupActiveProjectPassForProduct.mockResolvedValue({ ok: true, active: false })
    if (scenario === 'implicit') body.approve = false
    expect((await POST(request(body, origin), params)).status).toBeGreaterThanOrEqual(400)
    expect(mocks.storePlanApproval).not.toHaveBeenCalled()
  })
  it('does not certify failed or foreign artifacts as a plan', async () => {
    mocks.loadAgentRunResults.mockResolvedValue([{ ...saved, verification: { status: 'blocked' } }, { ...saved, stepId: 'other', runId: 'other' }])
    expect(await preview()).toMatchObject({ ready: false, plan: null })
  })
})
