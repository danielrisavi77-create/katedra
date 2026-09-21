import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({ createAdminClient:vi.fn(),getStripe:vi.fn(),reconcilePendingRefunds:vi.fn() }))
vi.mock('@/lib/supabase/admin',()=>({ createAdminClient:mocks.createAdminClient }))
vi.mock('@/lib/stripe',()=>({ getStripe:mocks.getStripe }))
vi.mock('@/lib/stripe/refund-worker',()=>({ reconcilePendingRefunds:mocks.reconcilePendingRefunds }))
import { POST } from './route'
afterEach(()=>{vi.resetAllMocks();vi.unstubAllEnvs()})
describe('refund reconciliation authorization',()=>{
  it.each([undefined,'wrong'])('rejects %s before creating privileged clients',async token=>{
    vi.stubEnv('KATEDRA_AGENT_WORKER_TOKEN','fixture-worker')
    const result=await POST(new Request('http://localhost/api/internal/refund-reconciliation',{method:'POST',headers:token?{'x-katedra-agent-worker-token':token}:{}}))
    expect(result.status).toBe(401)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    expect(mocks.getStripe).not.toHaveBeenCalled()
  })
  it('keeps reconciliation disabled with the project-lock contract',async()=>{
    vi.stubEnv('KATEDRA_AGENT_WORKER_TOKEN','fixture-worker')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED','false')
    const result=await POST(new Request('http://localhost/api/internal/refund-reconciliation',{method:'POST',headers:{'x-katedra-agent-worker-token':'fixture-worker'}}))
    expect(result.status).toBe(503)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })
  it('returns counts only to an authorized worker',async()=>{
    vi.stubEnv('KATEDRA_AGENT_WORKER_TOKEN','fixture-worker')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED','true')
    mocks.createAdminClient.mockReturnValue({rpc:vi.fn()})
    mocks.reconcilePendingRefunds.mockResolvedValue({checked:1,succeeded:1,pending:0,deferred:0})
    const result=await POST(new Request('http://localhost/api/internal/refund-reconciliation',{method:'POST',headers:{'x-katedra-agent-worker-token':'fixture-worker'}}))
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({checked:1,succeeded:1,pending:0,deferred:0})
  })
})
