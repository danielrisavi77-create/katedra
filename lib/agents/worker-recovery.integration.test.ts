import { describe, expect, it, vi } from 'vitest'
import { executionContextFixture, executionRecoveryFixture } from './execution-recovery.fixture'
import { executeBilledAgentProvider } from './billed-provider-execution'
import { runAgentWorkerLoop } from './worker-loop'
import { storeAgentStepResult } from './run-result-storage'

describe('worker recovery after an acknowledged ambiguous outcome', () => {
  it.each(['settlement', 'result_upload', 'completion'])('recovers %s uncertainty through the real worker and result store', async failure => {
    const fixture = executionRecoveryFixture()
    let runState = 'running'
    let leaseAvailable = true
    let loseCompletion = failure === 'completion'
    const created = Date.now()
    const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
      if (name === 'claim_agent_step') {
        if (!leaseAvailable || runState !== 'running') return { data: null }
        leaseAvailable = false
        return { data: { step_id: 'step-1', agent: 'intake', verifier: 'intake_verifier',
          step_order: 0, attempt: 1, status: 'running', lease_owner: 'worker-1', claimed_at: executionContextFixture.stepClaimedAt } }
      }
      if (name === 'complete_agent_step') {
        if (loseCompletion) { loseCompletion = false; throw Error('completion acknowledgement unavailable') }
        runState = params.p_status === 'verified' ? 'completed' : 'failed'
        return { data: { status: params.p_status } }
      }
      if (name === 'reserve_agent_result_payload') return { data: [{ manifest_id: 'result-manifest',
        storage_path: 'user-1/project-1/run-1/results/step-1-1.json', manifest_path: 'user-1/project-1/run-1/results/step-1-1.manifest.json',
        created_at: new Date(created).toISOString(), expires_at: new Date(created + 72 * 3600000).toISOString() }] }
      return fixture.rpc(name, params)
    })
    const db = { rpc, storage: { from: () => ({ ...fixture.db.storage.from(), remove: vi.fn() }) } }
    const run = vi.fn(async function* () {
      yield { type: 'completed' as const, value: { output: 'Original answer', usage: { inputTokens: 10, outputTokens: 20 } } }
    })
    let observations = 0
    const execute = async () => ({ ...await executeBilledAgentProvider(db, { provider: { id: 'fixture', capabilities: ['text'], run },
      agentInput: { projectId: 'project-1', runId: 'run-1', attempt: 1, payload: {} },
      execution: { ...executionContextFixture, stepId: 'step-1', workerId: 'worker-1' },
      userId: 'user-1', projectId: 'project-1', requestId: 'worker-replay', model: 'fixture-model' }),
      citations: [{ id: 'citation-1', verified: true, verification: { status: 'verified' as const, method: 'crossref' as const,
        checkedAt: new Date(created + ++observations * 1000).toISOString() } }] })
    const verify = vi.fn(async () => ({ status: 'verified' as const, issues: [], evidence: [] }))
    let loseUpload = failure === 'result_upload'
    const storeResult = vi.fn(async ({ step, result, verification }) => {
      if (loseUpload) { loseUpload = false; fixture.faults.add('upload:after') }
      const stored = await storeAgentStepResult(db, { userId: 'user-1', projectId: 'project-1', runId: 'run-1', step, result, verification })
      if (!stored.ok) throw Error('result storage uncertain')
      return { manifestId: stored.value.manifestId }
    })
    const dependencies = { db, runId: 'run-1', workerId: 'worker-1', storeResult }
    if (failure === 'settlement') fixture.faults.add('settle_agent_provider_execution:after')
    const first = await runAgentWorkerLoop(dependencies, { execute, verify }, { maxSteps: 1 })
    expect(first.status).toBe(failure === 'completion' ? 'failed' : 'reconciliation_pending')
    expect(runState).toBe('running')
    if (failure === 'settlement') expect(storeResult).not.toHaveBeenCalled()
    if (failure !== 'completion') expect(rpc).not.toHaveBeenCalledWith('complete_agent_step', expect.anything())
    // Simulate the canonical lease expiring; the real SQL lease CAS is covered
    // by Lekta's two-connection execution contract tests.
    leaseAvailable = true
    fixture.confirmUploads()
    const second = await runAgentWorkerLoop(dependencies, { execute, verify }, { maxSteps: 1 })
    expect(second.status).toBe('limit')
    expect(runState).toBe('completed')
    expect(storeResult).toHaveBeenCalledTimes(failure === 'settlement' ? 1 : 2)
    expect(storeResult).toHaveBeenCalledWith(expect.objectContaining({ result: expect.objectContaining({ output: 'Original answer' }) }))
    expect(verify).toHaveBeenCalledTimes(failure === 'settlement' ? 1 : 2)
    expect(run).toHaveBeenCalledTimes(1)
    expect(fixture.debitCount()).toBe(1)
  })
})
