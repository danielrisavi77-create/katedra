import { describe, expect, it, vi } from 'vitest'

import { activateAgentRun, attachAgentPayloadsToRun, cancelAgentRun, claimAgentStep, cleanupStaleInitializingAgentRun, completeAgentStep, createAgentRun, pauseAgentRun, registerAgentPayload, replaceAgentPayloadsForRun, resumeAgentRun } from './backend-contract'

describe('canonical agent backend contract', () => {
  it('preserves the exact canonical step lease timestamp for provider start authorization', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      step_id: 'step-1', agent: 'intake', verifier: 'intake_verifier', step_order: 0, attempt: 1, status: 'running',
      lease_owner: 'worker-1', claimed_at: '2026-09-08T18:00:00.123456+00:00',
    } })
    await expect(claimAgentStep({ rpc }, { runId: 'run-1', workerId: 'worker-1' })).resolves.toMatchObject({
      ok: true, value: { executionLease: { workerId: 'worker-1', claimedAt: '2026-09-08T18:00:00.123456+00:00' } },
    })
  })
  it('creates a run through the Lekta RPC and normalizes its id', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { run_id: 'run-1' }, error: null })
    await expect(createAgentRun({ rpc }, {
      userId: 'user-1', projectId: 'project-1', mode: 'autonomous', sourcePolicy: 'web_research', sectionIds: ['intro', 'analysis'],
    })).resolves.toEqual({ ok: true, runId: 'run-1' })
    expect(rpc).toHaveBeenCalledWith('create_agent_run', {
      p_user_id: 'user-1', p_project_id: 'project-1', p_mode: 'autonomous', p_source_policy: 'web_research',
      p_section_ids: ['intro', 'analysis'],
    })
  })

  it('cleans up only a stale initializing run for the owned project', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ run_id: 'run-stale', status: 'cancelled' }], error: null })
    await expect(cleanupStaleInitializingAgentRun({ rpc }, {
      userId: 'user-1', projectId: 'project-1',
    })).resolves.toEqual({ ok: true, value: { runId: 'run-stale', status: 'cancelled' } })
    expect(rpc).toHaveBeenCalledWith('cleanup_stale_initializing_agent_run', {
      p_user_id: 'user-1', p_project_id: 'project-1',
    })
  })

  it('fails closed when the claim RPC is unavailable', async () => {
    const rpc = vi.fn().mockRejectedValue(new Error('function unavailable'))
    await expect(claimAgentStep({ rpc }, { runId: 'run-1', workerId: 'worker-1' })).resolves.toMatchObject({ ok: false })
  })

  it('fails closed when the canonical claim returns an invalid step shape', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ step_id: '', agent: 'unknown-agent', verifier: 'intake_verifier', step_order: 0, attempt: 1, status: 'running' }],
      error: null,
    })

    await expect(claimAgentStep({ rpc }, { runId: 'run-1', workerId: 'worker-1' }))
      .resolves.toEqual({ ok: false, error: 'Lekta claim_agent_step vratio je neispravan korak.' })
  })

  it('completes a step with verification and usage metadata', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'verified' }, error: null })
    await expect(completeAgentStep({ rpc }, {
      runId: 'run-1', stepId: 'step-1', workerId: 'worker-1', status: 'verified', attempt: 1, provider: 'anthropic',
      usage: { inputTokens: 10, outputTokens: 20 },
    })).resolves.toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('complete_agent_step', expect.objectContaining({
      p_run_id: 'run-1', p_step_id: 'step-1', p_status: 'verified', p_attempt: 1, p_provider: 'anthropic',
      p_worker_id: 'worker-1',
    }))
  })

  it('registers only the temporary storage manifest through Lekta', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { manifest_id: 'manifest-1' }, error: null })
    await expect(registerAgentPayload({ rpc }, {
      userId: 'user-1', projectId: 'project-1', materialId: 'material-1',
      storageBucket: 'katedra-temporary-materials', storagePath: 'user-1/project-1/material',
      manifestPath: 'user-1/project-1/material.manifest.json', expiresAt: '2026-08-17T00:00:00.000Z',
    })).resolves.toEqual({ ok: true, value: { manifestId: 'manifest-1' } })
    expect(rpc).toHaveBeenCalledWith('register_agent_payload', expect.objectContaining({
      p_user_id: 'user-1', p_project_id: 'project-1', p_storage_bucket: 'katedra-temporary-materials',
    }))
  })

  it('attaches only canonical payload ids to the created run', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ material_id: 'material-1' }, { material_id: 'material-2' }], error: null })
    await expect(attachAgentPayloadsToRun({ rpc }, {
      userId: 'user-1', projectId: 'project-1', runId: 'run-1', materialIds: ['material-1', 'material-2'],
    })).resolves.toEqual({ ok: true, value: { materialIds: ['material-1', 'material-2'] } })
    expect(rpc).toHaveBeenCalledWith('attach_agent_payloads_to_run', {
      p_user_id: 'user-1', p_project_id: 'project-1', p_run_id: 'run-1', p_material_ids: ['material-1', 'material-2'],
    })
  })

  it('replaces the selected run materials atomically through the canonical RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ material_id: 'material-2' }], error: null })
    await expect(replaceAgentPayloadsForRun({ rpc }, {
      userId: 'user-1', projectId: 'project-1', runId: 'run-1', materialIds: ['material-2'],
    })).resolves.toEqual({ ok: true, value: { materialIds: ['material-2'] } })
    expect(rpc).toHaveBeenCalledWith('replace_agent_payloads_for_run', {
      p_user_id: 'user-1', p_project_id: 'project-1', p_run_id: 'run-1', p_material_ids: ['material-2'],
    })
  })

  it('mijenja status runa preko ownership-checked Lekta RPC-a', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ run_id: 'run-1', status: 'paused' }], error: null })
    await expect(pauseAgentRun({ rpc }, { userId: 'user-1', runId: 'run-1' })).resolves.toMatchObject({ ok: true, value: { status: 'paused' } })
    expect(rpc).toHaveBeenCalledWith('pause_agent_run', { p_user_id: 'user-1', p_run_id: 'run-1' })

    rpc.mockResolvedValue({ data: [{ run_id: 'run-1', status: 'running' }], error: null })
    await expect(resumeAgentRun({ rpc }, { userId: 'user-1', runId: 'run-1' })).resolves.toMatchObject({ ok: true, value: { status: 'running' } })
    expect(rpc).toHaveBeenCalledWith('resume_agent_run', { p_user_id: 'user-1', p_run_id: 'run-1' })

    rpc.mockResolvedValue({ data: [{ run_id: 'run-1', status: 'cancelled' }], error: null })
    await expect(cancelAgentRun({ rpc }, { userId: 'user-1', runId: 'run-1' })).resolves.toMatchObject({ ok: true, value: { status: 'cancelled' } })
    expect(rpc).toHaveBeenCalledWith('cancel_agent_run', { p_user_id: 'user-1', p_run_id: 'run-1' })
  })

  it('activira samo pripremljeni run preko canonical RPC-a', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ run_id: 'run-1', status: 'pending' }], error: null })
    await expect(activateAgentRun({ rpc }, { userId: 'user-1', runId: 'run-1' })).resolves.toEqual({ ok: true, value: { runId: 'run-1', status: 'pending' } })
    expect(rpc).toHaveBeenCalledWith('activate_agent_run', { p_user_id: 'user-1', p_run_id: 'run-1' })
  })
})
