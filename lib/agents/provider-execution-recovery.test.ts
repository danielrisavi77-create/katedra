import { describe, expect, it, vi } from 'vitest'
import { executionContextFixture, executionRecoveryFixture } from './execution-recovery.fixture'
import { executeRecoveredProviderOperation } from './provider-execution-recovery.server'
import { AI_MODEL_COST_MULTIPLIERS } from '../ai/cost-policy'

function operation() {
  return { userId: 'user-1', projectId: 'project-1', runId: 'run-1', requestId: 'original-request',
    provider: 'fixture', model: 'fixture-model', attempt: 1, operation: 'provider' as const,
    execution: executionContextFixture, payload: { messages: [{ role: 'user', content: 'Synthetic input' }] },
    execute: vi.fn(async () => ({ value: { output: 'Original answer' }, usage: { inputTokens: 10, outputTokens: 20 } })) }
}

describe('original provider response recovery', () => {
  it('replays identical original value and usage with one provider call and one debit', async () => {
    const fixture = executionRecoveryFixture(), input = operation()
    const first = await executeRecoveredProviderOperation(fixture.db, input)
    const second = await executeRecoveredProviderOperation(fixture.db, input)
    expect(second).toEqual(first)
    expect(second).toMatchObject({ value: { output: 'Original answer' }, charged: 110, billingState: 'settled' })
    expect(input.execute).toHaveBeenCalledTimes(1)
    expect(fixture.debitCount()).toBe(1)
  })
  it('does not call the provider after an ambiguous start acknowledgement', async () => {
    const fixture = executionRecoveryFixture(), input = operation()
    fixture.faults.add('start_agent_provider_execution:after')
    await expect(executeRecoveredProviderOperation(fixture.db, input)).rejects.toMatchObject({ billingState: 'pending_reconciliation' })
    await expect(executeRecoveredProviderOperation(fixture.db, input)).rejects.toMatchObject({ billingState: 'pending_reconciliation' })
    expect(input.execute).not.toHaveBeenCalled()
  })
  it.each(['commit_agent_provider_response:after', 'settle_agent_provider_execution:after'])('recovers %s without regeneration', async fault => {
    const fixture = executionRecoveryFixture(), input = operation()
    fixture.faults.add(fault)
    try { await executeRecoveredProviderOperation(fixture.db, input) } catch { /* later invocation recovers */ }
    await expect(executeRecoveredProviderOperation(fixture.db, input)).resolves.toMatchObject({ value: { output: 'Original answer' }, charged: 110 })
    expect(input.execute).toHaveBeenCalledTimes(1)
    expect(fixture.debitCount()).toBe(1)
  })
  it('rejects changed input without making a second provider call', async () => {
    const fixture = executionRecoveryFixture(), input = operation()
    await executeRecoveredProviderOperation(fixture.db, input)
    await expect(executeRecoveredProviderOperation(fixture.db, { ...input, payload: { changed: true } })).rejects.toBeDefined()
    expect(input.execute).toHaveBeenCalledTimes(1)
  })
  it('rejects withdrawn consent on replay', async () => {
    const fixture = executionRecoveryFixture(), input = operation()
    await executeRecoveredProviderOperation(fixture.db, input)
    fixture.withdraw()
    await expect(executeRecoveredProviderOperation(fixture.db, input)).rejects.toBeDefined()
    expect(input.execute).toHaveBeenCalledTimes(1)
  })
  it('refuses corrupt stored bytes without regenerating', async () => {
    const fixture = executionRecoveryFixture(), input = operation()
    await executeRecoveredProviderOperation(fixture.db, input)
    const e = fixture.executions.get(input.requestId)!
    fixture.objects.set(e.storagePath, new TextEncoder().encode('corrupt'))
    await expect(executeRecoveredProviderOperation(fixture.db, input)).rejects.toBeDefined()
    expect(input.execute).toHaveBeenCalledTimes(1)
  })
  it('waits for canonical upload reconciliation before recovering an ambiguous upload', async () => {
    const fixture = executionRecoveryFixture(), input = operation()
    fixture.faults.add('upload:after')
    await expect(executeRecoveredProviderOperation(fixture.db, input)).rejects.toMatchObject({ billingState: 'pending_reconciliation' })
    await expect(executeRecoveredProviderOperation(fixture.db, input)).rejects.toBeDefined()
    expect(fixture.debitCount()).toBe(0)
    fixture.confirmUploads()
    await expect(executeRecoveredProviderOperation(fixture.db, input)).resolves.toMatchObject({ value: { output: 'Original answer' } })
    expect(input.execute).toHaveBeenCalledTimes(1)
    expect(fixture.debitCount()).toBe(1)
  })
  it('never regenerates deleted response bytes', async () => {
    const fixture = executionRecoveryFixture(), input = operation()
    await executeRecoveredProviderOperation(fixture.db, input)
    fixture.objects.clear()
    await expect(executeRecoveredProviderOperation(fixture.db, input)).rejects.toBeDefined()
    expect(input.execute).toHaveBeenCalledTimes(1)
  })
  it('persists unknown usage without estimating a debit', async () => {
    const fixture = executionRecoveryFixture(), input = { ...operation(), execute: vi.fn(async () => ({ value: 'answer' })) }
    await expect(executeRecoveredProviderOperation(fixture.db, input)).rejects.toMatchObject({ billingState: 'pending_reconciliation' })
    await expect(executeRecoveredProviderOperation(fixture.db, input)).rejects.toBeDefined()
    expect(fixture.executions.get(input.requestId)).toMatchObject({ inputTokens: null, outputTokens: null, charged: null })
    expect(fixture.objects.size).toBe(2)
    expect(fixture.debitCount()).toBe(0)
    expect(input.execute).toHaveBeenCalledTimes(1)
  })
  it('does not describe an unrecorded response as durable evidence', async () => {
    const fixture = executionRecoveryFixture(), input = operation()
    fixture.faults.add('record_agent_provider_response:before')
    await expect(executeRecoveredProviderOperation(fixture.db, input)).rejects.toBeDefined()
    expect(fixture.executions.get(input.requestId)).toMatchObject({ status: 'unresolved' })
    expect(fixture.objects.size).toBe(0)
    await expect(executeRecoveredProviderOperation(fixture.db, input)).rejects.toBeDefined()
    expect(input.execute).toHaveBeenCalledTimes(1)
    expect(fixture.debitCount()).toBe(0)
  })
  it('authorizes one provider start across concurrent invocations', async () => {
    const fixture = executionRecoveryFixture(), input = operation()
    const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () => executeRecoveredProviderOperation(fixture.db, input)))
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(input.execute).toHaveBeenCalledTimes(1)
    expect(fixture.debitCount()).toBe(1)
  })
  it('uses the original price after a pricing change', async () => {
    const fixture = executionRecoveryFixture(), input = operation()
    const first = await executeRecoveredProviderOperation(fixture.db, input)
    AI_MODEL_COST_MULTIPLIERS[input.model] = 10
    try { expect(await executeRecoveredProviderOperation(fixture.db, input)).toEqual(first) }
    finally { delete AI_MODEL_COST_MULTIPLIERS[input.model] }
  })
  it('does not treat provider timeouts as a new retryable attempt', async () => {
    const fixture = executionRecoveryFixture(), input = { ...operation(), execute: vi.fn(async () => { throw Error('timeout') }) }
    await expect(executeRecoveredProviderOperation(fixture.db, input)).rejects.toMatchObject({ billingState: 'pending_reconciliation' })
    await expect(executeRecoveredProviderOperation(fixture.db, input)).rejects.toBeDefined()
    expect(input.execute).toHaveBeenCalledTimes(1)
  })
})
