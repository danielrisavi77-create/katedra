import { describe, expect, it, vi } from 'vitest'
import { reconcilePendingRefunds } from './refund-worker'

const entry = { session_id:'cs_retry',payment_intent_id:'pi_retry',user_id:'user-1',project_id:'project-1',amount:1000,currency:'eur',refund_id:'re_retry',status:'pending',lease_token:'lease' }
describe('bounded refund reconciliation',()=>{
  it('refreshes a persisted refund without creating or granting anything',async()=>{
    const rpc=vi.fn(async name=>({ data:name==='list_pending_katedra_pass_refunds'?[entry]:name==='claim_katedra_pass_refund'?entry:null,error:null }))
    const refunds={ retrieve:vi.fn().mockResolvedValue({ id:'re_retry',payment_intent:'pi_retry',amount:1000,currency:'eur',status:'succeeded' }),create:vi.fn() }
    expect(await reconcilePendingRefunds({ rpc },{ refunds })).toEqual({ checked:1,succeeded:1,pending:0,deferred:0 })
    expect(refunds.create).not.toHaveBeenCalled()
    expect(rpc.mock.calls.map(([name])=>name)).toEqual(['list_pending_katedra_pass_refunds','claim_katedra_pass_refund','record_katedra_pass_refund'])
  })
  it('leaves unstarted work in the durable queue at the deadline',async()=>{
    const rpc=vi.fn().mockResolvedValue({ data:[entry],error:null })
    expect(await reconcilePendingRefunds({ rpc },{}, { now:()=>1,deadlineAt:1 })).toEqual({ checked:0,succeeded:0,pending:0,deferred:1 })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('does not disguise an unavailable queue as zero pending refunds',async()=>{
    const rpc=vi.fn().mockResolvedValue({ data:null,error:{} })
    await expect(reconcilePendingRefunds({ rpc },{})).rejects.toThrow('Refund queue unavailable')
  })
})
