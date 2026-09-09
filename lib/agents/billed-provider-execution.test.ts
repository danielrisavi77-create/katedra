import { describe, expect, it, vi } from 'vitest'
import type { AgentProvider } from './contracts'
import { AgentBillingReconciliationError, executeBilledAgentProvider } from './billed-provider-execution'
import { executionContextFixture, executionRecoveryFixture } from './execution-recovery.fixture'

function operation(usage: unknown = { inputTokens: 10, outputTokens: 20 }) {
  const run = vi.fn(async function* () {
    yield { type: 'completed' as const, value: { output: 'Original output', usage } }
  })
  return { provider: { id: 'fixture', capabilities: ['text'], run } as AgentProvider,
    agentInput: { projectId: 'project-1', runId: 'run-1', payload: { messages: [] }, attempt: 1 as const },
    execution: executionContextFixture, userId: 'user-1', projectId: 'project-1', requestId: 'billing-recovery', model: 'fixture-model' }
}

describe('billed provider execution', () => {
  it('returns the original parsed provider result on replay and releases the reservation', async () => {
    const fixture = executionRecoveryFixture(), input = operation()
    const first = await executeBilledAgentProvider(fixture.db, input)
    expect(await executeBilledAgentProvider(fixture.db, input)).toEqual(first)
    expect(first).toMatchObject({ output: 'Original output', provider: 'fixture', usage: { inputTokens: 10, outputTokens: 20 }, billingState: 'settled' })
    expect(input.provider.run).toHaveBeenCalledTimes(1)
    expect(fixture.debitCount()).toBe(1)
    expect(fixture.rpc).toHaveBeenNthCalledWith(1, 'claim_agent_provider_execution', expect.anything())
    expect(fixture.rpc).toHaveBeenCalledWith('katedra_release_request', { p_user: 'user-1', p_request_id: input.requestId })
    expect(fixture.rpc).not.toHaveBeenCalledWith('katedra_consume', expect.anything())
  })
  it.each(['before', 'after'])('preserves actual usage after settlement fails %s commit', async phase => {
    const fixture = executionRecoveryFixture(), input = operation()
    fixture.faults.add(`settle_agent_provider_execution:${phase}`)
    await expect(executeBilledAgentProvider(fixture.db, input)).rejects.toBeInstanceOf(AgentBillingReconciliationError)
    expect(fixture.executions.get(input.requestId)).toMatchObject({ inputTokens: 10, outputTokens: 20, charged: 110 })
    await expect(executeBilledAgentProvider(fixture.db, input)).resolves.toMatchObject({ output: 'Original output' })
    expect(input.provider.run).toHaveBeenCalledTimes(1)
    expect(fixture.debitCount()).toBe(1)
  })
  it('retains unknown usage without estimating a debit', async () => {
    const fixture = executionRecoveryFixture(), input = operation({ inputTokens: 0, outputTokens: 0 })
    await expect(executeBilledAgentProvider(fixture.db, input)).rejects.toMatchObject({ billingState: 'pending_reconciliation' })
    expect(fixture.executions.get(input.requestId)).toMatchObject({ inputTokens: null, outputTokens: null, charged: null })
    expect(fixture.debitCount()).toBe(0)
  })
  it('does not invoke a provider without a canonical step lease', async () => {
    const fixture = executionRecoveryFixture(), input = operation()
    await expect(executeBilledAgentProvider(fixture.db, { ...input, execution: undefined })).rejects.toBeInstanceOf(AgentBillingReconciliationError)
    expect(input.provider.run).not.toHaveBeenCalled()
  })
  it('retries a transient reservation release failure', async () => {
    const fixture = executionRecoveryFixture(), input = operation()
    fixture.faults.add('katedra_release_request:before')
    await expect(executeBilledAgentProvider(fixture.db, input)).resolves.toMatchObject({ billingState: 'settled' })
    expect(fixture.rpc.mock.calls.filter(([name]) => name === 'katedra_release_request')).toHaveLength(2)
  })
})
