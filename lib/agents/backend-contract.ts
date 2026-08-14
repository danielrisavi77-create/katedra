import type { AgentStepRecord, AgentStepStatus } from './run-state'
import type { AgentRunMode, SourcePolicy } from './run-state'
import type { UsageRecord, VerificationResultV1 } from './contracts'

interface RpcClient {
  rpc: (functionName: string, params: Record<string, unknown>) => Promise<{ data?: unknown; error?: { message?: string } | null }>
}

export type AgentBackendResult<T> = { ok: true; value: T } | { ok: false; error: string }
export type AgentRunControlStatus = 'paused' | 'cancelled'
export type AgentStepCompletionStatus = 'verified' | 'blocked' | 'failed' | AgentRunControlStatus

export async function createAgentRun(db: RpcClient, input: {
  userId: string
  projectId: string
  mode: AgentRunMode
  sourcePolicy: SourcePolicy
  sectionIds?: string[]
}): Promise<{ ok: true; runId: string } | { ok: false; error: string }> {
  const params: Record<string, unknown> = {
    p_user_id: input.userId,
    p_project_id: input.projectId,
    p_mode: input.mode,
    p_source_policy: input.sourcePolicy,
  }
  if (input.sectionIds?.length) params.p_section_ids = input.sectionIds
  const result = await callRpc(db, 'create_agent_run', params)
  if (result.ok === false) return { ok: false, error: result.error }
  const row = firstRecord(result.data)
  const runId = String(row?.run_id ?? row?.runId ?? '')
  return runId ? { ok: true, runId } : { ok: false, error: 'Lekta create_agent_run nije vratio runId.' }
}

export async function activateAgentRun(db: RpcClient, input: { userId: string; runId: string }): Promise<AgentBackendResult<{ runId: string; status: string }>> {
  return transitionAgentRun(db, 'activate_agent_run', input)
}

export async function claimAgentStep(db: RpcClient, input: { runId: string; workerId: string }): Promise<AgentBackendResult<AgentStepRecord | null> & { backendStatus?: AgentRunControlStatus }> {
  const result = await callRpc(db, 'claim_agent_step', {
    p_run_id: input.runId,
    p_worker_id: input.workerId,
  })
  if (result.ok === false) return { ok: false, error: result.error }
  const row = firstRecord(result.data)
  const backendStatus = controlStatus(row?.status)
  if (backendStatus) return { ok: true, value: null, backendStatus }
  return { ok: true, value: row ? normalizeStep(row) : null }
}

export async function completeAgentStep(db: RpcClient, input: {
  runId: string
  stepId: string
  workerId: string
  status: 'verified' | 'blocked' | 'failed'
  attempt: 1 | 2 | 3
  provider: string
  usage: UsageRecord
  verification?: VerificationResultV1
  requeue?: boolean
}): Promise<{ ok: true } | { ok: true; value: { status: AgentStepCompletionStatus } } | { ok: false; error: string }> {
  const result = await callRpc(db, 'complete_agent_step', {
    p_run_id: input.runId,
    p_step_id: input.stepId,
    p_worker_id: input.workerId,
    p_status: input.status,
    p_attempt: input.attempt,
    p_provider: input.provider,
    p_usage: input.usage,
    p_verification: input.verification || null,
    p_requeue: input.requeue === true,
  })
  if (result.ok === false) return { ok: false, error: result.error }
  const row = firstRecord(result.data)
  const status = row?.status == null ? undefined : String(row.status) as AgentStepCompletionStatus
  return status === 'paused' || status === 'cancelled'
    ? { ok: true, value: { status } }
    : { ok: true }
}

export async function cleanupExpiredAgentPayloads(db: RpcClient, input: { now?: string } = {}): Promise<AgentBackendResult<{ deleted: number }>> {
  const result = await callRpc(db, 'cleanup_expired_agent_payloads', { p_now: input.now || new Date().toISOString() })
  if (result.ok === false) return { ok: false, error: result.error }
  const rows = Array.isArray(result.data) ? result.data : []
  const row = firstRecord(result.data)
  return { ok: true, value: { deleted: rows.length || Number(row?.deleted ?? row?.deleted_count ?? 0) } }
}

export async function registerAgentPayload(db: RpcClient, input: {
  userId: string
  projectId: string
  runId?: string
  materialId: string
  storageBucket: string
  storagePath: string
  manifestPath: string
  expiresAt: string
}): Promise<AgentBackendResult<{ manifestId: string }>> {
  const result = await callRpc(db, 'register_agent_payload', {
    p_user_id: input.userId,
    p_project_id: input.projectId,
    p_run_id: input.runId || null,
    p_material_id: input.materialId,
    p_storage_bucket: input.storageBucket,
    p_storage_path: input.storagePath,
    p_manifest_path: input.manifestPath,
    p_expires_at: input.expiresAt,
  })
  if (result.ok === false) return { ok: false, error: result.error }
  const row = firstRecord(result.data)
  const manifestId = String(row?.manifest_id ?? row?.manifestId ?? '')
  return manifestId ? { ok: true, value: { manifestId } } : { ok: false, error: 'Lekta register_agent_payload nije vratio manifestId.' }
}

export async function attachAgentPayloadsToRun(db: RpcClient, input: {
  userId: string
  projectId: string
  runId: string
  materialIds: string[]
}): Promise<AgentBackendResult<{ materialIds: string[] }>> {
  const result = await callRpc(db, 'attach_agent_payloads_to_run', {
    p_user_id: input.userId,
    p_project_id: input.projectId,
    p_run_id: input.runId,
    p_material_ids: input.materialIds,
  })
  if (result.ok === false) return { ok: false, error: result.error }
  const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : []
  const materialIds = rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const id = String((row as Record<string, unknown>).material_id ?? (row as Record<string, unknown>).materialId ?? '')
    return id ? [id] : []
  })
  return { ok: true, value: { materialIds } }
}

export async function pauseAgentRun(db: RpcClient, input: { userId: string; runId: string }): Promise<AgentBackendResult<{ runId: string; status: string }>> {
  return transitionAgentRun(db, 'pause_agent_run', input)
}

export async function resumeAgentRun(db: RpcClient, input: { userId: string; runId: string }): Promise<AgentBackendResult<{ runId: string; status: string }>> {
  return transitionAgentRun(db, 'resume_agent_run', input)
}

export async function cancelAgentRun(db: RpcClient, input: { userId: string; runId: string }): Promise<AgentBackendResult<{ runId: string; status: string }>> {
  return transitionAgentRun(db, 'cancel_agent_run', input)
}

async function transitionAgentRun(
  db: RpcClient,
  functionName: 'activate_agent_run' | 'pause_agent_run' | 'resume_agent_run' | 'cancel_agent_run',
  input: { userId: string; runId: string },
): Promise<AgentBackendResult<{ runId: string; status: string }>> {
  const result = await callRpc(db, functionName, { p_user_id: input.userId, p_run_id: input.runId })
  if (result.ok === false) return { ok: false, error: result.error }
  const row = firstRecord(result.data)
  const runId = String(row?.run_id ?? row?.runId ?? '')
  const status = String(row?.status ?? '')
  return runId && status ? { ok: true, value: { runId, status } } : { ok: false, error: `Lekta ${functionName} nije vratio stanje runa.` }
}

async function callRpc(db: RpcClient, functionName: string, params: Record<string, unknown>): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const result = await db.rpc(functionName, params)
    if (result?.error) return { ok: false, error: result.error.message || `${functionName} nije uspio.` }
    return { ok: true, data: result?.data }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `${functionName} nije dostupan.` }
  }
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) ? value[0] : value
  return row && typeof row === 'object' ? row as Record<string, unknown> : null
}

function controlStatus(value: unknown): AgentRunControlStatus | undefined {
  return value === 'paused' || value === 'cancelled' ? value : undefined
}

function normalizeStep(row: Record<string, unknown>): AgentStepRecord {
  const status = String(row.status || 'pending') as AgentStepStatus
  const attempt = Math.min(3, Math.max(1, Number(row.attempt || 1))) as 1 | 2 | 3
  return {
    id: String(row.step_id ?? row.id ?? ''),
    agent: String(row.agent || 'intake') as AgentStepRecord['agent'],
    verifier: String(row.verifier || 'intake_verifier') as AgentStepRecord['verifier'],
    sectionId: row.section_id == null ? undefined : String(row.section_id),
    order: Number(row.step_order ?? row.order ?? 0),
    attempt,
    status,
    lastVerification: row.last_verification as AgentStepRecord['lastVerification'],
  }
}
