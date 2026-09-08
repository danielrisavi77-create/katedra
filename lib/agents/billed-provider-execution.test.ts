import { describe, expect, it, vi } from 'vitest'

import type { AgentProvider } from './contracts'
import { AgentBillingReconciliationError, executeBilledAgentProvider, executeBilledOperation } from './billed-provider-execution'

function providerWithEvents(events: Array<{ type: 'completed' | 'error'; value?: unknown; message?: string }>): AgentProvider {
  return {
    id: 'fake-provider',
    capabilities: ['text'],
    async *run() {
      for (const event of events) yield event as never
    },
  }
}

describe('billed provider execution', () => {
  it.each(['throw', 'error', 'unknown'])('preserves actual usage after a consume %s', async (failure) => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'katedra_reserve_request') return { data: { status: 'reserved' }, error: null }
      if (name === 'katedra_consume') {
        if (failure === 'throw') throw new Error('connection lost')
        return { data: { status: 'unknown' }, error: failure === 'error' ? { message: 'unavailable' } : null }
      }
      if (name === 'record_katedra_billing_usage') return { data: { status: 'pending_reconciliation' }, error: null }
      return { data: { status: 'released' }, error: null }
    })
    await expect(executeBilledOperation({ rpc }, {
      provider: 'fixture', model: 'fixture-model', userId: 'user-1', projectId: 'project-1', requestId: 'usage-recovery',
      execute: async () => ({ value: 'result', usage: { inputTokens: 10, outputTokens: 20 } }),
    })).rejects.toMatchObject({ billingState: 'pending_reconciliation' })
    expect(rpc).toHaveBeenCalledWith('record_katedra_billing_usage', {
      p_user: 'user-1', p_project_id: 'project-1', p_request_id: 'usage-recovery', p_model: 'fixture-model', p_in: 10, p_out: 20, p_charged: 110,
    })
    expect(rpc).not.toHaveBeenCalledWith('katedra_mark_pending', expect.anything())
  })
  it('recovers a committed settlement when the first database response was lost', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'katedra_reserve_request') return { data: { status: 'reserved' }, error: null }
      if (name === 'katedra_consume') throw new Error('response lost')
      if (name === 'record_katedra_billing_usage') return { data: { status: 'already_settled' }, error: null }
      return { data: { status: 'released' }, error: null }
    })
    const execute = vi.fn(async () => ({ value: 'result', usage: { inputTokens: 10, outputTokens: 20 } }))
    await expect(executeBilledOperation({ rpc }, {
      provider: 'fixture', model: 'fixture-model', userId: 'user-1', projectId: 'project-1', requestId: 'committed-recovery', execute,
    })).resolves.toMatchObject({ value: 'result', billingState: 'settled', charged: 110 })
    expect(execute).toHaveBeenCalledTimes(1)
  })
  it('uses the same billing lifecycle for a non-chat verifier operation', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'katedra_reserve_request') return { data: { status: 'reserved' }, error: null }
      if (name === 'katedra_consume') return { data: { status: 'settled' }, error: null }
      if (name === 'katedra_release_request') return { data: { status: 'released' }, error: null }
      return { data: null, error: null }
    })

    const result = await executeBilledOperation({ rpc }, {
      provider: 'independent-verifier',
      model: 'verifier-model',
      agent: 'writing_verifier',
      runId: 'run-1',
      attempt: 1,
      payload: { task: 'verify_claim_passages' },
      userId: 'user-1',
      projectId: 'project-1',
      requestId: 'run-1:step-1:1:passage',
      execute: async () => ({ value: { outcome: 'verified' }, usage: { inputTokens: 12, outputTokens: 8 } }),
    })

    expect(result).toMatchObject({ value: { outcome: 'verified' }, usage: { inputTokens: 12, outputTokens: 8 }, billingState: 'settled' })
    expect(rpc).toHaveBeenCalledWith('katedra_consume', expect.objectContaining({
      p_request_id: 'run-1:step-1:1:passage',
      p_project_id: 'project-1',
      p_in: 12,
      p_out: 8,
    }))
  })

  it('reserves, settles exactly once, and releases the distributed reservation', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'katedra_reserve_request') return { data: { status: 'reserved' }, error: null }
      if (name === 'katedra_consume') return { data: { status: 'settled' }, error: null }
      if (name === 'katedra_release_request') return { data: { status: 'released' }, error: null }
      return { data: null, error: null }
    })
    const result = await executeBilledAgentProvider({ rpc }, {
      provider: providerWithEvents([{ type: 'completed', value: { output: 'tekst', usage: { inputTokens: 10, outputTokens: 20 } } }]),
      agentInput: { projectId: 'project-1', runId: 'run-1', payload: { messages: [] }, attempt: 1 },
      userId: 'user-1', projectId: 'project-1', requestId: 'run-1:step-1:1', model: 'agent-model',
    })

    expect(result).toMatchObject({ output: 'tekst', provider: 'fake-provider', usage: { inputTokens: 10, outputTokens: 20 }, billingState: 'settled' })
    expect(rpc).toHaveBeenNthCalledWith(1, 'katedra_reserve_request', expect.objectContaining({ p_request_id: 'run-1:step-1:1' }))
    expect(rpc).toHaveBeenCalledWith('katedra_consume', expect.objectContaining({ p_request_id: 'run-1:step-1:1', p_project_id: 'project-1', p_in: 10, p_out: 20 }))
    expect(rpc).toHaveBeenCalledWith('katedra_release_request', { p_user: 'user-1', p_request_id: 'run-1:step-1:1' })
  })

  it('releases without consuming when the provider fails', async () => {
    const rpc = vi.fn(async (name: string) => name === 'katedra_reserve_request'
      ? { data: { status: 'reserved' }, error: null }
      : { data: { status: 'released' }, error: null })

    await expect(executeBilledAgentProvider({ rpc }, {
      provider: providerWithEvents([{ type: 'error', message: 'provider down' }]),
      agentInput: { projectId: 'project-1', payload: {}, attempt: 1 },
      userId: 'user-1', projectId: 'project-1', requestId: 'request-2', model: 'agent-model',
    })).rejects.toThrow('provider down')
    expect(rpc).toHaveBeenCalledWith('katedra_release_request', { p_user: 'user-1', p_request_id: 'request-2' })
    expect(rpc).not.toHaveBeenCalledWith('katedra_consume', expect.anything())
  })

  it('fails closed and releases when provider usage is unavailable', async () => {
    const rpc = vi.fn(async (name: string) => name === 'katedra_reserve_request'
      ? { data: { status: 'reserved' }, error: null }
      : name === 'katedra_mark_pending'
        ? { data: { status: 'pending_reconciliation' }, error: null }
        : { data: { status: 'released' }, error: null })

    await expect(executeBilledAgentProvider({ rpc }, {
      provider: providerWithEvents([{ type: 'completed', value: { output: 'tekst', usage: { inputTokens: 0, outputTokens: 0 } } }]),
      agentInput: { projectId: 'project-1', payload: {}, attempt: 1 },
      userId: 'user-1', projectId: 'project-1', requestId: 'request-3', model: 'agent-model',
    })).rejects.toMatchObject({ billingState: 'pending_reconciliation' })
    expect(rpc).not.toHaveBeenCalledWith('katedra_consume', expect.anything())
    expect(rpc).toHaveBeenCalledWith('katedra_mark_pending', expect.objectContaining({ p_request_id: 'request-3', p_estimated_charge: expect.any(Number) }))
  })

  it('surfaces a failed pending marker instead of pretending reconciliation was recorded', async () => {
    const rpc = vi.fn(async (name: string) => name === 'katedra_reserve_request'
      ? { data: { status: 'reserved' }, error: null }
      : name === 'katedra_mark_pending'
        ? { data: null, error: null }
        : { data: { status: 'released' }, error: null })

    await expect(executeBilledAgentProvider({ rpc }, {
      provider: providerWithEvents([{ type: 'completed', value: { output: 'tekst', usage: { inputTokens: 0, outputTokens: 0 } } }]),
      agentInput: { projectId: 'project-1', payload: {}, attempt: 1 },
      userId: 'user-1', projectId: 'project-1', requestId: 'request-missing-marker', model: 'agent-model',
    })).rejects.toThrow('reconciliation marker unavailable')
  })

  it('marks an unknown consume response as pending reconciliation instead of hiding billing ambiguity', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'katedra_reserve_request') return { data: { status: 'reserved' }, error: null }
      if (name === 'katedra_consume') return { data: { status: 'unexpected_status' }, error: null }
      if (name === 'record_katedra_billing_usage') return { data: { status: 'pending_reconciliation' }, error: null }
      return { data: { status: 'released' }, error: null }
    })

    await expect(executeBilledAgentProvider({ rpc }, {
      provider: providerWithEvents([{ type: 'completed', value: { output: 'tekst', usage: { inputTokens: 10, outputTokens: 20 } } }]),
      agentInput: { projectId: 'project-1', payload: {}, attempt: 1 },
      userId: 'user-1', projectId: 'project-1', requestId: 'request-ambiguous', model: 'agent-model',
    })).rejects.toMatchObject({
      constructor: AgentBillingReconciliationError,
      billingState: 'pending_reconciliation',
    })
    expect(rpc).toHaveBeenCalledWith('katedra_release_request', { p_user: 'user-1', p_request_id: 'request-ambiguous' })
    expect(rpc).toHaveBeenCalledWith('record_katedra_billing_usage', expect.objectContaining({ p_request_id: 'request-ambiguous', p_charged: 110, p_in: 10, p_out: 20 }))
  })

  it('retries a transient reservation release failure after billing settles', async () => {
    let releaseAttempts = 0
    const rpc = vi.fn(async (name: string) => {
      if (name === 'katedra_reserve_request') return { data: { status: 'reserved' }, error: null }
      if (name === 'katedra_consume') return { data: { status: 'settled' }, error: null }
      releaseAttempts += 1
      if (releaseAttempts === 1) throw new Error('temporary release failure')
      return { data: { status: 'released' }, error: null }
    })

    await expect(executeBilledAgentProvider({ rpc }, {
      provider: providerWithEvents([{ type: 'completed', value: { output: 'tekst', usage: { inputTokens: 10, outputTokens: 20 } } }]),
      agentInput: { projectId: 'project-1', payload: {}, attempt: 1 },
      userId: 'user-1', projectId: 'project-1', requestId: 'request-release-retry', model: 'agent-model',
    })).resolves.toMatchObject({ billingState: 'settled' })

    expect(releaseAttempts).toBe(2)
  })
})
