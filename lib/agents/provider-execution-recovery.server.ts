import { createHash, randomUUID } from 'node:crypto'
import { AI_MODEL_COST_MULTIPLIERS, estimateChatCharge } from '../ai/cost-policy'
import { releaseRateLimitReservation, reserveDistributedRequest } from '../ai/rate-limit.js'
import type { UsageRecord } from './contracts'
import { AgentBillingReconciliationError } from './billing-errors'
import { trackedPayloadUpload, type TrackedUploadClient } from './tracked-upload'

const MAX_BYTES = 1_500_000
const OUTPUT_WEIGHT = 5
const PRICING_VERSION = 'katedra-agent-tokens-v1'
const BUCKET = 'katedra-temporary-materials'

export interface ProviderExecutionContext {
  contextRevision: string
  stepId: string
  workerId: string
  // Preserve PostgreSQL microseconds; converting through Date loses lease identity.
  stepClaimedAt: string
}

export interface RecoverableOperation<T> {
  userId: string
  projectId: string
  runId: string
  requestId: string
  provider: string
  model: string
  attempt: number
  operation: 'provider' | 'passage'
  execution: ProviderExecutionContext
  payload?: unknown
  maxOutputTokens?: number
  execute: () => Promise<{ value: T; usage?: UsageRecord }>
}

type Metadata = Record<string, unknown>
const hash = (body: Uint8Array | string) => createHash('sha256').update(body).digest('hex')
const pending = () => new AgentBillingReconciliationError('Original agent response requires reconciliation.', 'pending_reconciliation')

/** Canonical start authorization is consumed before any external provider call.
 * Only the original immutable response may subsequently settle or be replayed.
 * Unknown starts remain unresolved, including an unavailable start acknowledgement.
 */
export async function executeRecoveredProviderOperation<T>(db: TrackedUploadClient, input: RecoverableOperation<T>): Promise<{
  value: T; usage: UsageRecord; billingState: 'settled'; charged: number
}> {
  try {
    if (!input.execution?.contextRevision || !input.execution.stepId || !input.execution.workerId
      || !input.execution.stepClaimedAt || !input.runId || ![1, 2, 3].includes(input.attempt)) throw pending()
    const maxOutputTokens = input.maxOutputTokens ?? 4096
    const fingerprint = canonicalJson({ payload: input.payload ?? null, maxOutputTokens })
    const identity = {
      userId: input.userId, projectId: input.projectId, runId: input.runId,
      contextRevision: input.execution.contextRevision, stepId: input.execution.stepId,
      attempt: input.attempt, operation: input.operation, provider: input.provider, model: input.model,
      inputSha256: hash(fingerprint), requestId: input.requestId,
    }
    const owner = randomUUID()
    const claimed = await rpc(db, 'claim_agent_provider_execution', { p_identity: identity, p_owner: owner })
    if (claimed.status !== 'claimed') return await recover<T>(db, claimed, identity)

    const reservation = await reserveDistributedRequest(db, {
      userId: input.userId, requestId: input.requestId,
      estimatedCharge: estimateChatCharge({ inputChars: fingerprint.length, model: input.model, maxOutputTokens, outputWeight: OUTPUT_WEIGHT }),
    })
    if (!reservation.allowed || typeof reservation.release !== 'function') {
      throw new AgentBillingReconciliationError('Agent billing reservation unavailable.', 'released')
    }
    try {
      const start = await rpc(db, 'start_agent_provider_execution', {
        p_execution: claimed.executionId, p_owner: owner,
        p_worker_id: input.execution.workerId, p_step_claimed_at: input.execution.stepClaimedAt,
      })
      if (start.status !== 'start' || typeof start.startToken !== 'string') throw pending()
      validateLocation(start, identity)
      const result = await input.execute()
      const usage = normalizeUsage(result.usage)
      const charged = usage ? Math.max(1, Math.round((usage.inputTokens + OUTPUT_WEIGHT * usage.outputTokens)
        * (AI_MODEL_COST_MULTIPLIERS[input.model] ?? 1))) : null
      const envelope = {
        schemaVersion: 1, kind: 'agent-provider-response', executionId: start.executionId, identity,
        value: result.value, usage, charged, pricingVersion: PRICING_VERSION,
        createdAt: start.createdAt, expiresAt: start.expiresAt,
      }
      const body = encode(envelope)
      const descriptor = encode(describe(envelope, body))
      const evidence = {
        responseSha256: hash(body), responseBytes: body.byteLength,
        descriptorSha256: hash(descriptor), descriptorBytes: descriptor.byteLength,
        inputTokens: usage?.inputTokens ?? null, outputTokens: usage?.outputTokens ?? null,
        charged, pricingVersion: PRICING_VERSION,
      }
      // This metadata survives consent withdrawal. Publication and settlement still
      // require current consent and a live manifest in the canonical RPCs.
      await rpc(db, 'record_agent_provider_response', {
        p_execution: start.executionId, p_start_token: start.startToken, p_evidence: evidence,
      })
      await publish(db, start, body, descriptor)
      return await settle<T>(db, start, JSON.parse(new TextDecoder().decode(body)))
    } finally {
      await releaseRateLimitReservation(reservation)
    }
  } catch (error) {
    // Never let an uncertain provider start become an automatically retryable
    // provider error. No raw provider/RPC error or content crosses this boundary.
    if (error instanceof AgentBillingReconciliationError) throw error
    throw pending()
  }
}

async function recover<T>(db: TrackedUploadClient, record: Metadata, identity: Metadata) {
  if (!['response_recorded', 'response_ready', 'settled'].includes(String(record.status))) throw pending()
  validateLocation(record, identity)
  const body = await download(db, String(record.storagePath), record.responseBytes, record.responseSha256)
  const envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body))
  if (!envelope || envelope.schemaVersion !== 1 || envelope.kind !== 'agent-provider-response'
    || envelope.executionId !== record.executionId || canonicalJson(envelope.identity) !== canonicalJson(identity)
    || envelope.expiresAt !== record.expiresAt || !Object.hasOwn(envelope, 'value')
    || envelope.charged !== record.charged || envelope.pricingVersion !== record.pricingVersion
    || (envelope.usage?.inputTokens ?? null) !== record.inputTokens
    || (envelope.usage?.outputTokens ?? null) !== record.outputTokens) throw pending()
  const created = Date.parse(envelope.createdAt), expires = Date.parse(envelope.expiresAt)
  if (!Number.isFinite(created) || expires <= created || expires - created > 72 * 3600000) throw pending()
  const descriptor = encode(describe(envelope, body))
  if (descriptor.byteLength !== record.descriptorBytes || hash(descriptor) !== record.descriptorSha256) throw pending()
  if (record.status === 'response_recorded') {
    // A reconciler may have confirmed an upload whose acknowledgement was lost.
    // trackedPayloadUpload accepts only proven stored bytes, never overwrites them.
    await publish(db, record, body, descriptor)
  } else {
    await download(db, String(record.manifestPath), record.descriptorBytes, record.descriptorSha256)
  }
  return settle<T>(db, record, envelope)
}

async function publish(db: TrackedUploadClient, record: Metadata, body: Uint8Array, descriptor: Uint8Array) {
  for (const [kind, path, bytes] of [
    ['body', record.storagePath, body], ['manifest', record.manifestPath, descriptor],
  ] as const) {
    if (!await trackedPayloadUpload(db, { manifestId: String(record.manifestId), kind, path: String(path), body: bytes })) throw pending()
  }
  const committed = await rpc(db, 'commit_agent_provider_response', { p_execution: record.executionId })
  if (!['response_ready', 'settled'].includes(String(committed.status))) throw pending()
}

async function settle<T>(db: TrackedUploadClient, record: Metadata, envelope: Metadata) {
  const settled = await rpc(db, 'settle_agent_provider_execution', { p_execution: record.executionId })
  const usage = normalizeUsage(envelope.usage as UsageRecord)
  if (!['settled', 'already_settled'].includes(String(settled.status)) || !usage
    || !Number.isSafeInteger(settled.charged) || Number(settled.charged) <= 0
    || settled.charged !== envelope.charged || settled.inputTokens !== usage.inputTokens
    || settled.outputTokens !== usage.outputTokens || settled.pricingVersion !== envelope.pricingVersion) throw pending()
  return { value: envelope.value as T, usage, billingState: 'settled' as const, charged: Number(settled.charged) }
}

function describe(envelope: Metadata, body: Uint8Array) {
  return { schemaVersion: 1, kind: 'agent-provider-response-manifest', executionId: envelope.executionId,
    identity: envelope.identity, responseSha256: hash(body), responseBytes: body.byteLength,
    createdAt: envelope.createdAt, expiresAt: envelope.expiresAt }
}

function validateLocation(record: Metadata, identity: Metadata) {
  if (typeof record.executionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(record.executionId)
    || typeof record.manifestId !== 'string') throw pending()
  const prefix = `${identity.userId}/${identity.projectId}/${identity.runId}/executions/${record.executionId}`
  if (record.storagePath !== `${prefix}.json` || record.manifestPath !== `${prefix}.manifest.json`
    || typeof record.expiresAt !== 'string' || !(Date.parse(record.expiresAt) > Date.now())) throw pending()
}

async function rpc(db: TrackedUploadClient, name: string, params: Metadata): Promise<Metadata> {
  const result = await db.rpc(name, params)
  if (result?.error || !result?.data || typeof result.data !== 'object' || Array.isArray(result.data)) throw pending()
  return result.data as Metadata
}

async function download(db: TrackedUploadClient, path: string, length: unknown, sha: unknown) {
  if (!Number.isSafeInteger(length) || Number(length) < 1 || Number(length) > MAX_BYTES
    || typeof sha !== 'string' || !/^[0-9a-f]{64}$/.test(sha)) throw pending()
  const result = await db.storage.from(BUCKET).download?.(path)
  if (!result || result.error || !result.data) throw pending()
  const value = result.data
  let bytes: Uint8Array
  if (value instanceof Uint8Array) bytes = value
  else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value)
  else if (value instanceof Blob && value.size === length) bytes = new Uint8Array(await value.arrayBuffer())
  else throw pending()
  if (bytes.byteLength !== length || hash(bytes) !== sha) throw pending()
  return bytes
}

function normalizeUsage(value: UsageRecord | undefined): UsageRecord | null {
  if (!value || !Number.isSafeInteger(value.inputTokens) || !Number.isSafeInteger(value.outputTokens)
    || value.inputTokens < 0 || value.outputTokens < 0 || value.inputTokens + value.outputTokens <= 0) return null
  return { inputTokens: value.inputTokens, outputTokens: value.outputTokens }
}

function encode(value: unknown) {
  const bytes = new TextEncoder().encode(canonicalJson(value))
  if (bytes.byteLength > MAX_BYTES) throw pending()
  return bytes
}

function canonicalJson(value: unknown): string {
  // Normalize JSON semantics first (omitted optional properties, array nulls),
  // then order object keys. Object.fromEntries avoids special __proto__ setters.
  const sort = (node: unknown, depth: number): unknown => {
    if (depth > 100) throw pending()
    if (Array.isArray(node)) return node.map(item => sort(item, depth + 1))
    if (node && typeof node === 'object') return Object.fromEntries(Object.keys(node).sort()
      .map(key => [key, sort((node as Metadata)[key], depth + 1)]))
    return node
  }
  return JSON.stringify(sort(JSON.parse(JSON.stringify(value)), 0))
}
