import { createHash, randomUUID } from 'node:crypto'
import { vi } from 'vitest'

// Stateful canonical boundary double. Real SQL lease/consent/debit behavior is
// tested separately by Lekta's agent-execution-recovery-smoke.sql.
export function executionRecoveryFixture() {
  const objects = new Map<string, Uint8Array>()
  const executions = new Map<string, Record<string, any>>()
  const intents = new Map<string, { sha: string; bytes: number; state: string }>()
  const faults = new Set<string>()
  let debits = 0
  let consent = true
  const rpc = vi.fn(async (name: string, params: Record<string, any>) => {
    if (faults.delete(`${name}:before`)) throw Error('response unavailable')
    let data: any
    if (name === 'claim_agent_provider_execution') {
      if (!consent) return { error: { message: 'consent unavailable' } }
      const id = params.p_identity
      let e = executions.get(id.requestId)
      if (e && JSON.stringify(e.identity) !== JSON.stringify(id)) return { error: { message: 'identity conflict' } }
      if (!e) {
        e = { identity: id, executionId: randomUUID(), status: 'claimed', owner: params.p_owner }
        executions.set(id.requestId, e)
      }
      data = { ...e, status: e.status === 'claimed' && e.owner !== params.p_owner ? 'busy' : e.status }
      delete data.startToken
    } else if (name === 'katedra_reserve_request') data = { status: 'reserved' }
    else if (name === 'katedra_release_request') data = { status: 'released' }
    else if (name === 'start_agent_provider_execution') {
      const e = [...executions.values()].find(e => e.executionId === params.p_execution)!
      if (!consent) return { error: { message: 'consent unavailable' } }
      if (e.status !== 'claimed') data = { status: 'unresolved' }
      else {
        const prefix = `${e.identity.userId}/${e.identity.projectId}/${e.identity.runId}/executions/${e.executionId}`
        const created = Date.now()
        Object.assign(e, { status: 'unresolved', startToken: randomUUID(), manifestId: randomUUID(),
          storagePath: `${prefix}.json`, manifestPath: `${prefix}.manifest.json`,
          createdAt: new Date(created).toISOString(), expiresAt: new Date(created + 72 * 3600000).toISOString() })
        data = { ...e, status: 'start' }
      }
    } else if (name === 'record_agent_provider_response') {
      const e = [...executions.values()].find(e => e.executionId === params.p_execution)!
      if (e.startToken !== params.p_start_token) return { error: { message: 'start token mismatch' } }
      if (e.evidence && JSON.stringify(e.evidence) !== JSON.stringify(params.p_evidence)) return { error: { message: 'immutable evidence' } }
      e.evidence = params.p_evidence
      Object.assign(e, params.p_evidence, { status: 'response_recorded' })
      data = { status: 'response_recorded' }
    } else if (name === 'begin_agent_payload_upload') {
      if (!consent) return { error: { message: 'consent unavailable' } }
      const key = `${params.p_manifest_id}:${params.p_object_kind}`
      const old = intents.get(key)
      if (old) data = old.sha === params.p_sha256 && old.bytes === params.p_bytes && old.state === 'uploaded' ? 'stored' : 'uncertain'
      else { intents.set(key, { sha: params.p_sha256, bytes: params.p_bytes, state: 'uploading' }); data = 'upload' }
    } else if (name === 'finish_agent_payload_upload') {
      const intent = intents.get(`${params.p_manifest_id}:${params.p_object_kind}`)!
      intent.state = params.p_succeeded && consent ? 'uploaded' : 'uncertain'
      data = intent.state
    } else if (name === 'commit_agent_provider_response') {
      const e = [...executions.values()].find(e => e.executionId === params.p_execution)!
      if (!consent || !objects.has(e.storagePath) || !objects.has(e.manifestPath)
        || ['body', 'manifest'].some(k => intents.get(`${e.manifestId}:${k}`)?.state !== 'uploaded')) return { error: { message: 'incomplete custody' } }
      if (e.status !== 'settled') e.status = 'response_ready'
      data = { status: e.status }
    } else if (name === 'settle_agent_provider_execution') {
      const e = [...executions.values()].find(e => e.executionId === params.p_execution)!
      if (!consent || !['response_ready', 'settled'].includes(e.status)) return { error: { message: 'unavailable' } }
      if (e.inputTokens == null) data = { status: 'pending_reconciliation', reason: 'usage_evidence_required' }
      else {
        const status = e.status === 'settled' ? 'already_settled' : 'settled'
        if (status === 'settled') debits++
        e.status = 'settled'
        data = { status, charged: e.charged, inputTokens: e.inputTokens, outputTokens: e.outputTokens, pricingVersion: e.pricingVersion }
      }
    } else throw Error(`Unexpected RPC ${name}`)
    if (faults.delete(`${name}:after`)) throw Error('committed response lost')
    return { data, error: null }
  })
  const upload = vi.fn(async (path: string, body: Uint8Array, options: { upsert: boolean }) => {
    if (options.upsert || objects.has(path)) return { error: { message: 'immutable object' } }
    objects.set(path, new Uint8Array(body))
    if (faults.delete('upload:after')) throw Error('upload acknowledgement lost')
    return { error: null }
  })
  const download = vi.fn(async (path: string) => ({ data: objects.get(path), error: objects.has(path) ? null : { message: 'missing' } }))
  return { db: { rpc, storage: { from: vi.fn(() => ({ upload, download })) } }, rpc, upload, download, objects, executions, faults,
    debitCount: () => debits, withdraw: () => { consent = false },
    confirmUploads: () => { for (const intent of intents.values()) intent.state = 'uploaded' },
    hash: (body: Uint8Array) => createHash('sha256').update(body).digest('hex') }
}

export const executionContextFixture = {
  contextRevision: '50000000-0000-0000-0000-000000000001', stepId: '40000000-0000-0000-0000-000000000001',
  workerId: 'fixture-worker', stepClaimedAt: '2026-09-08T18:00:00.123456Z',
}
