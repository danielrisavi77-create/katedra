import { describe, expect, it, vi } from 'vitest'

import { runAgentWorkerLoop } from './worker-loop'

type Rpc = (name: string, params: Record<string, unknown>) => Promise<{
  data?: unknown
  error?: { message?: string } | null
}>

function handlers() {
  return {
    execute: vi.fn().mockResolvedValue({
      output: 'Tekst',
      citations: [],
      provider: 'test',
      usage: { inputTokens: 1, outputTokens: 1 },
    }),
    verify: vi.fn().mockReturnValue({ status: 'verified', issues: [], evidence: [] }),
  }
}

function step(attempt = 1, id = 'step-1') {
  return {
    step_id: id,
    agent: 'writing',
    verifier: 'writing_verifier',
    step_order: 0,
    attempt,
    status: 'running',
  }
}

function dependencies(rpc: Rpc) {
  return { db: { rpc }, workerId: 'worker-1', runId: 'run-1' }
}

describe('agent worker loop', () => {
  it('stops idle when no step is claimed', async () => {
    const rpc = vi.fn<Rpc>().mockResolvedValue({ data: [], error: null })
    const agentHandlers = handlers()

    await expect(runAgentWorkerLoop(dependencies(rpc), agentHandlers))
      .resolves.toMatchObject({ status: 'idle', stepsProcessed: 0 })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(agentHandlers.execute).not.toHaveBeenCalled()
  })

  it('processes two verified steps sequentially', async () => {
    const rpc = vi.fn<Rpc>()
      .mockResolvedValueOnce({ data: [step(1, 'step-1')], error: null })
      .mockResolvedValueOnce({ data: { status: 'verified' }, error: null })
      .mockResolvedValueOnce({ data: [step(1, 'step-2')], error: null })
      .mockResolvedValueOnce({ data: { status: 'verified' }, error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    const agentHandlers = handlers()

    const result = await runAgentWorkerLoop(dependencies(rpc), agentHandlers)

    expect(result).toMatchObject({ status: 'idle', stepsProcessed: 2, lastStepId: 'step-2' })
    expect(agentHandlers.execute).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls.filter(([name]) => name === 'claim_agent_step')).toHaveLength(3)
  })

  it('stops after retrying so the scheduler can claim the step again', async () => {
    const rpc = vi.fn<Rpc>()
      .mockResolvedValueOnce({ data: [step(1)], error: null })
      .mockResolvedValueOnce({ data: { status: 'failed' }, error: null })
      .mockResolvedValueOnce({ data: [step(2)], error: null })
      .mockResolvedValueOnce({ data: { status: 'verified' }, error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    const agentHandlers = handlers()
    agentHandlers.verify.mockReturnValueOnce({ status: 'needs_revision', issues: [], evidence: [] })

    const first = await runAgentWorkerLoop(dependencies(rpc), agentHandlers)
    const second = await runAgentWorkerLoop(dependencies(rpc), agentHandlers)

    expect(first).toMatchObject({ status: 'retrying', stepsProcessed: 1, lastStepId: 'step-1' })
    expect(second).toMatchObject({ status: 'idle', stepsProcessed: 1, lastStepId: 'step-1' })
    expect(rpc.mock.calls.filter(([name]) => name === 'claim_agent_step')).toHaveLength(3)
  })

  it('stops immediately when a step is blocked', async () => {
    const rpc = vi.fn<Rpc>()
      .mockResolvedValueOnce({ data: [step(3)], error: null })
      .mockResolvedValueOnce({ data: { status: 'blocked' }, error: null })
      .mockResolvedValueOnce({ data: [step(1, 'step-2')], error: null })
    const agentHandlers = handlers()
    agentHandlers.verify.mockReturnValue({ status: 'needs_revision', issues: [], evidence: [] })

    const result = await runAgentWorkerLoop(dependencies(rpc), agentHandlers)

    expect(result).toMatchObject({ status: 'blocked', stepsProcessed: 1, lastStepId: 'step-1' })
    expect(rpc.mock.calls.filter(([name]) => name === 'claim_agent_step')).toHaveLength(1)
  })

  it('does not claim more than the configured step limit', async () => {
    const rpc = vi.fn<Rpc>()
      .mockResolvedValueOnce({ data: [step(1, 'step-1')], error: null })
      .mockResolvedValueOnce({ data: { status: 'verified' }, error: null })
      .mockResolvedValueOnce({ data: [step(1, 'step-2')], error: null })
      .mockResolvedValueOnce({ data: { status: 'verified' }, error: null })
    const agentHandlers = handlers()

    const result = await runAgentWorkerLoop(dependencies(rpc), agentHandlers, { maxSteps: 2 })

    expect(result).toMatchObject({ status: 'limit', stepsProcessed: 2, lastStepId: 'step-2' })
    expect(rpc.mock.calls.filter(([name]) => name === 'claim_agent_step')).toHaveLength(2)
  })

  it('never claims a second step when maxSteps is one', async () => {
    const rpc = vi.fn<Rpc>()
      .mockResolvedValueOnce({ data: [step(1, 'step-1')], error: null })
      .mockResolvedValueOnce({ data: { status: 'verified' }, error: null })
      .mockResolvedValueOnce({ data: [step(1, 'step-2')], error: null })

    const result = await runAgentWorkerLoop(dependencies(rpc), handlers(), { maxSteps: 1 })

    expect(result).toMatchObject({ status: 'limit', stepsProcessed: 1, lastStepId: 'step-1' })
    expect(rpc.mock.calls.filter(([name]) => name === 'claim_agent_step')).toHaveLength(1)
  })

  it.each([
    ['paused', 'paused'],
    ['cancelled', 'cancelled'],
  ] as const)('honours a backend %s result', async (backendStatus, expectedStatus) => {
    const rpc = vi.fn<Rpc>()
      .mockResolvedValueOnce({ data: [step()], error: null })
      .mockResolvedValueOnce({ data: { status: backendStatus }, error: null })
    const agentHandlers = handlers()

    const result = await runAgentWorkerLoop(dependencies(rpc), agentHandlers)

    expect(result).toMatchObject({ status: expectedStatus, stepsProcessed: 1 })
    expect(rpc.mock.calls.filter(([name]) => name === 'claim_agent_step')).toHaveLength(1)
  })
})


describe('async gate verification through the worker loop', () => {
  it('awaits the gate before completion and forwards the claimed step', async () => {
    const rpc = vi.fn<Rpc>()
      .mockResolvedValueOnce({ data: [step(2)], error: null })
      .mockResolvedValueOnce({ data: { status: 'failed' }, error: null })
    const agentHandlers = handlers()
    const verify = vi.fn(async (_result, context) => {
      expect(context.step).toMatchObject({ id: 'step-1', agent: 'writing', attempt: 2 })
      expect(rpc).toHaveBeenCalledTimes(1)
      await Promise.resolve()
      return { status: 'needs_revision' as const, issues: [{ code: 'gate_finding' as const, message: 'Plan missing' }], evidence: [] }
    })
    const outcome = await runAgentWorkerLoop(dependencies(rpc), { ...agentHandlers, verify }, { maxSteps: 1 })
    expect(outcome.status).toBe('retrying')
    expect(verify).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenLastCalledWith('complete_agent_step', expect.objectContaining({
      p_requeue: true, p_verification: expect.objectContaining({ status: 'needs_revision', issues: [expect.objectContaining({ code: 'gate_finding' })] }),
    }))
  })
})
