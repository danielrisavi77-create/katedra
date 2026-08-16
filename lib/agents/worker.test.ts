import { describe, expect, it, vi } from 'vitest'

import { processClaimedAgentStep } from './worker'
import { ProviderCapabilityError } from './provider-router'
import { AgentBillingReconciliationError } from './billed-provider-execution'

describe('agent worker lease contract', () => {
  it('claims, verifies and completes a step exactly once', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', step_order: 0, attempt: 1, status: 'running' }], error: null })
      .mockResolvedValueOnce({ data: { status: 'verified' }, error: null })
    const result = await processClaimedAgentStep({ db: { rpc }, workerId: 'worker-1', runId: 'run-1' }, {
      execute: vi.fn().mockResolvedValue({ output: 'Tekst', citations: [{ id: 's-1', url: 'https://example.test', verified: true }], provider: 'test', usage: { inputTokens: 2, outputTokens: 3 } }),
      verify: vi.fn().mockReturnValue({ status: 'verified', issues: [], evidence: [] }),
    })
    expect(result).toMatchObject({ status: 'verified', stepId: 'step-1' })
    expect(rpc).toHaveBeenNthCalledWith(1, 'claim_agent_step', { p_run_id: 'run-1', p_worker_id: 'worker-1' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'complete_agent_step', expect.objectContaining({ p_step_id: 'step-1', p_status: 'verified' }))
  })

  it('persists the result before completing the step and stores only a manifest pointer', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', step_order: 0, attempt: 1, status: 'running' }], error: null })
      .mockResolvedValueOnce({ data: { status: 'verified' }, error: null })
    const storeResult = vi.fn().mockResolvedValue({ manifestId: 'manifest-result-1' })
    const result = await processClaimedAgentStep({ db: { rpc }, workerId: 'worker-1', runId: 'run-1', storeResult }, {
      execute: vi.fn().mockResolvedValue({ output: 'Tekst', citations: [], provider: 'test', usage: { inputTokens: 2, outputTokens: 3 } }),
      verify: vi.fn().mockReturnValue({ status: 'verified', issues: [], evidence: [] }),
    })

    expect(result).toMatchObject({ status: 'verified', stepId: 'step-1' })
    expect(storeResult).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenLastCalledWith('complete_agent_step', expect.objectContaining({ p_verification: expect.objectContaining({ resultPayloadId: 'manifest-result-1' }) }))
  })

  it('does not complete a missing claim', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    await expect(processClaimedAgentStep({ db: { rpc }, workerId: 'worker-1', runId: 'run-1' }, {
      execute: vi.fn(), verify: vi.fn(),
    })).resolves.toEqual({ status: 'idle' })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('does not attempt a second completion after the backend reports a stale lease', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', step_order: 1, attempt: 1, status: 'running' }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Agent step lease has expired' } })

    await expect(processClaimedAgentStep({ db: { rpc }, workerId: 'worker-1', runId: 'run-1' }, {
      execute: vi.fn().mockResolvedValue({ output: 'Tekst', citations: [], provider: 'test', usage: { inputTokens: 1, outputTokens: 1 } }),
      verify: vi.fn().mockReturnValue({ status: 'verified', issues: [], evidence: [] }),
    })).resolves.toMatchObject({ status: 'failed', stepId: 'step-1' })

    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls.filter(([name]) => name === 'complete_agent_step')).toHaveLength(1)
  })

  it('requeues a rejected attempt and blocks the third rejection', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', step_order: 0, attempt: 1, status: 'running' }], error: null })
      .mockResolvedValueOnce({ data: { status: 'failed' }, error: null })
    const retry = await processClaimedAgentStep({ db: { rpc }, workerId: 'worker-1', runId: 'run-1' }, {
      execute: vi.fn().mockResolvedValue({ output: 'Tekst', citations: [], provider: 'test', usage: { inputTokens: 1, outputTokens: 1 } }),
      verify: vi.fn().mockReturnValue({ status: 'needs_revision', issues: [], evidence: [] }),
    })
    expect(retry).toMatchObject({ status: 'retrying', stepId: 'step-1' })
    expect(rpc).toHaveBeenLastCalledWith('complete_agent_step', expect.objectContaining({ p_status: 'failed', p_requeue: true }))

    const thirdRpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', step_order: 0, attempt: 3, status: 'running' }], error: null })
      .mockResolvedValueOnce({ data: { status: 'blocked' }, error: null })
    const blocked = await processClaimedAgentStep({ db: { rpc: thirdRpc }, workerId: 'worker-1', runId: 'run-1' }, {
      execute: vi.fn().mockResolvedValue({ output: 'Tekst', citations: [], provider: 'test', usage: { inputTokens: 1, outputTokens: 1 } }),
      verify: vi.fn().mockReturnValue({ status: 'needs_revision', issues: [], evidence: [] }),
    })
    expect(blocked).toMatchObject({ status: 'blocked', stepId: 'step-1' })
    expect(thirdRpc).toHaveBeenLastCalledWith('complete_agent_step', expect.objectContaining({ p_status: 'blocked', p_requeue: false }))
  })

  it('blocks instead of marking a run failed when a required provider capability is unavailable', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ step_id: 'step-1', agent: 'sources', verifier: 'sources_verifier', step_order: 0, attempt: 1, status: 'running' }], error: null })
      .mockResolvedValueOnce({ data: { status: 'blocked' }, error: null })

    const result = await processClaimedAgentStep({ db: { rpc }, workerId: 'worker-1', runId: 'run-1' }, {
      execute: vi.fn().mockRejectedValue(new ProviderCapabilityError('researcher', 'web_research', 'sources')),
      verify: vi.fn(),
    })

    expect(result).toMatchObject({ status: 'blocked', stepId: 'step-1' })
    expect(rpc).toHaveBeenLastCalledWith('complete_agent_step', expect.objectContaining({
      p_status: 'blocked',
      p_requeue: false,
      p_verification: expect.objectContaining({ status: 'blocked' }),
    }))
  })

  it('requeues a transient provider failure until the bounded attempt limit', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', step_order: 0, attempt: 1, status: 'running' }], error: null })
      .mockResolvedValueOnce({ data: { status: 'failed' }, error: null })

    const result = await processClaimedAgentStep({ db: { rpc }, workerId: 'worker-1', runId: 'run-1' }, {
      execute: vi.fn().mockRejectedValue(Object.assign(new Error('AI usluga je privremeno nedostupna.'), { retryable: true })),
      verify: vi.fn(),
    })

    expect(result).toMatchObject({ status: 'retrying', stepId: 'step-1' })
    expect(rpc).toHaveBeenLastCalledWith('complete_agent_step', expect.objectContaining({ p_status: 'failed', p_requeue: true }))
  })

  it('does not persist raw provider error messages in the run verification record', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', step_order: 0, attempt: 1, status: 'running' }], error: null })
      .mockResolvedValueOnce({ data: { status: 'failed' }, error: null })

    await processClaimedAgentStep({ db: { rpc }, workerId: 'worker-1', runId: 'run-1' }, {
      execute: vi.fn().mockRejectedValue(Object.assign(new Error('private upstream response with prompt text'), { retryable: true })),
      verify: vi.fn(),
    })

    const verification = rpc.mock.calls[1][1].p_verification
    expect(JSON.stringify(verification)).not.toContain('private upstream response')
    expect(verification.issues[0].message).toContain('privremeno')
  })

  it('does not retry a non-retryable billing or configuration failure', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', step_order: 0, attempt: 1, status: 'running' }], error: null })
      .mockResolvedValueOnce({ data: { status: 'failed' }, error: null })

    const result = await processClaimedAgentStep({ db: { rpc }, workerId: 'worker-1', runId: 'run-1' }, {
      execute: vi.fn().mockRejectedValue(new Error('Agent billing finalization unavailable.')),
      verify: vi.fn(),
    })

    expect(result).toMatchObject({ status: 'failed', stepId: 'step-1' })
    expect(rpc).toHaveBeenLastCalledWith('complete_agent_step', expect.objectContaining({ p_status: 'failed', p_requeue: false }))
  })

  it('persists pending billing reconciliation without blindly retrying the provider call', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', step_order: 0, attempt: 1, status: 'running' }], error: null })
      .mockResolvedValueOnce({ data: { status: 'failed' }, error: null })

    const result = await processClaimedAgentStep({ db: { rpc }, workerId: 'worker-1', runId: 'run-1' }, {
      execute: vi.fn().mockRejectedValue(new AgentBillingReconciliationError('Billing finalizacija je nejasna.', 'pending_reconciliation')),
      verify: vi.fn(),
    })

    expect(result).toMatchObject({ status: 'failed', stepId: 'step-1' })
    expect(rpc).toHaveBeenLastCalledWith('complete_agent_step', expect.objectContaining({
      p_status: 'failed',
      p_requeue: false,
      p_verification: expect.objectContaining({
        status: 'failed',
        billingState: 'pending_reconciliation',
        issues: [expect.objectContaining({ code: 'billing_reconciliation_pending' })],
      }),
    }))
  })

  it('preserves a settled billing outcome when result persistence fails', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', step_order: 0, attempt: 1, status: 'running' }], error: null })
      .mockResolvedValueOnce({ data: { status: 'failed' }, error: null })

    const result = await processClaimedAgentStep({
      db: { rpc },
      workerId: 'worker-1',
      runId: 'run-1',
      storeResult: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    }, {
      execute: vi.fn().mockResolvedValue({
        output: 'Tekst',
        citations: [],
        provider: 'test',
        usage: { inputTokens: 2, outputTokens: 3 },
        billingState: 'settled',
      }),
      verify: vi.fn().mockReturnValue({ status: 'verified', issues: [], evidence: [] }),
    })

    expect(result).toMatchObject({ status: 'failed', stepId: 'step-1' })
    expect(rpc).toHaveBeenLastCalledWith('complete_agent_step', expect.objectContaining({
      p_status: 'failed',
      p_verification: expect.objectContaining({ billingState: 'settled' }),
    }))
  })
})
