import { registerAgentPayload } from './backend-contract'
import { isAgentId, type AgentResultV1, type CitationEvidence, type ClaimEvidence, type ClaimSupportVerification, type UsageRecord, type VerificationResultV1 } from './contracts'
import type { AgentStepRecord } from './run-state'
import type { RunPayloadManifest, RunPayloadManifestStore, RunPayloadStorage } from './run-context-loader'
import { mapWithConcurrency } from '../async/map-limited'
import { isScopedAgentPayload } from './payload-scope'
import { citationVerificationMethod } from './source-verification'

const DEFAULT_BUCKET = 'katedra-temporary-materials'
const RESULT_TTL_MS = 72 * 60 * 60 * 1000
const MAX_RESULT_BYTES = 1_500_000
const MAX_RESULT_MANIFEST_BYTES = 2 * 1024 * 1024
const MAX_RESULT_ENTRIES = 512
const MAX_TOTAL_RESULT_BYTES = 32 * 1024 * 1024
const RESULT_PREFIX = 'agent-result:'

export interface AgentStepResultPayloadV1 {
  schemaVersion: 1
  kind: 'agent-step-result'
  materialId: string
  projectId: string
  runId: string
  stepId: string
  agent: AgentResultV1['agent']
  verifier: AgentStepRecord['verifier']
  stepOrder?: number
  sectionId?: string
  baseRevision?: string
  attempt: 1 | 2 | 3
  output: string
  citations: CitationEvidence[]
  claims?: ClaimEvidence[]
  inputArtifactIds?: string[]
  verification: VerificationResultV1
  provider: string
  usage: UsageRecord
  billingState?: AgentResultV1['billingState']
  createdAt: string
  expiresAt: string
}

interface ResultStorageObjectClient {
  upload: (path: string, body: Uint8Array, options: { contentType: string; cacheControl: string; upsert: boolean }) => Promise<{ error?: { message?: string } | null }>
  remove: (paths: string[]) => Promise<{ error?: { message?: string } | null }>
  download?: (path: string) => Promise<{ data?: unknown; error?: { message?: string } | null }>
}

interface ResultDatabase {
  rpc: (functionName: string, params: Record<string, unknown>) => Promise<{ data?: unknown; error?: { message?: string } | null }>
}

export type StoreAgentStepResult =
  | { ok: true; value: { manifestId: string; materialId: string; expiresAt: string } }
  | { ok: false; error: string }

export async function storeAgentStepResult(
  db: ResultDatabase & { storage?: { from: (bucket: string) => ResultStorageObjectClient } },
  input: {
    userId: string
    projectId: string
    runId: string
    step: AgentStepRecord
    result: Omit<AgentResultV1, 'agent'>
    verification: VerificationResultV1
    bucket?: string
    now?: () => number
  },
): Promise<StoreAgentStepResult> {
  if (!db.storage) return { ok: false, error: 'Privatna pohrana rezultata nije dostupna.' }
  if (![1, 2, 3].includes(input.step.attempt)) {
    return { ok: false, error: 'Pokusaj agenta nije valjan.' }
  }
  if (input.result.sectionId !== input.step.sectionId) {
    return { ok: false, error: 'Rezultat agenta ne pripada claimanoj sekciji.' }
  }
  const output = typeof input.result.output === 'string' ? input.result.output : JSON.stringify(input.result.output ?? '')
  const now = (input.now || Date.now)()
  const createdAt = new Date(now).toISOString()
  const expiresAt = new Date(now + RESULT_TTL_MS).toISOString()
  const materialId = `${RESULT_PREFIX}${safeSegment(input.step.id)}:${input.step.attempt}`
  const basePath = `${safeSegment(input.userId)}/${safeSegment(input.projectId)}/${safeSegment(input.runId)}/results`
  const storagePath = `${basePath}/${safeSegment(input.step.id)}-${input.step.attempt}.json`
  const manifestPath = `${basePath}/${safeSegment(input.step.id)}-${input.step.attempt}.manifest.json`
  const payload: AgentStepResultPayloadV1 = {
    schemaVersion: 1,
    kind: 'agent-step-result',
    materialId,
    projectId: input.projectId,
    runId: input.runId,
    stepId: input.step.id,
    agent: input.step.agent,
    verifier: input.step.verifier,
    stepOrder: input.step.order,
    ...(input.step.sectionId ? { sectionId: input.step.sectionId } : {}),
    ...(input.result.baseRevision ? { baseRevision: input.result.baseRevision } : {}),
    attempt: input.step.attempt,
    output,
    citations: Array.isArray(input.result.citations) ? input.result.citations.slice(0, 100) : [],
    ...(Array.isArray(input.result.claims) ? { claims: input.result.claims.slice(0, 200) } : {}),
    ...(Array.isArray(input.result.inputArtifactIds)
      ? { inputArtifactIds: uniqueBoundedStrings(input.result.inputArtifactIds, 100) }
      : {}),
    verification: input.verification,
    provider: input.result.provider,
    usage: input.result.usage || { inputTokens: 0, outputTokens: 0 },
    ...(input.result.billingState ? { billingState: input.result.billingState } : {}),
    createdAt,
    expiresAt,
  }
  const body = new TextEncoder().encode(JSON.stringify(payload))
  if (body.byteLength > MAX_RESULT_BYTES) return { ok: false, error: 'Rezultat agenta je prevelik za privremenu pohranu.' }
  const bucket = input.bucket || DEFAULT_BUCKET
  const manifest = { ...payload, storageBucket: bucket, storagePath, manifestPath }
  const storage = db.storage.from(bucket)
  const identity = { kind: 'agent-step-result', materialId, projectId: input.projectId, runId: input.runId, stepId: input.step.id }
  const payloadUpload = await ensureImmutableObject(storage, storagePath, body, identity)
  if (!payloadUpload.ok) return { ok: false, error: 'Spremanje rezultata agenta nije uspjelo.' }
  const manifestBody = new TextEncoder().encode(JSON.stringify(manifest))
  const manifestUpload = await ensureImmutableObject(storage, manifestPath, manifestBody, identity)
  if (!manifestUpload.ok) {
    if (payloadUpload.created) await storage.remove([storagePath])
    return { ok: false, error: 'Spremanje manifesta rezultata nije uspjelo.' }
  }
  const persistedExpiresAt = readExpiresAt(manifestUpload.body) || expiresAt
  const registered = await registerAgentPayload(db, {
    userId: input.userId,
    projectId: input.projectId,
    runId: input.runId,
    materialId,
    storageBucket: bucket,
    storagePath,
    manifestPath,
    expiresAt: persistedExpiresAt,
  })
  if (!registered.ok) {
    if (payloadUpload.created || manifestUpload.created) await storage.remove([storagePath, manifestPath])
    return { ok: false, error: 'Registracija rezultata agenta nije uspjela.' }
  }
  return { ok: true, value: { manifestId: registered.value.manifestId, materialId, expiresAt: persistedExpiresAt } }
}

async function ensureImmutableObject(
  storage: ResultStorageObjectClient,
  path: string,
  body: Uint8Array,
  identity: { kind: string; materialId: string; projectId: string; runId: string; stepId: string },
): Promise<{ ok: true; created: boolean; body: Uint8Array } | { ok: false }> {
  const uploaded = await storage.upload(path, body, { contentType: 'application/json', cacheControl: '3600', upsert: false })
  if (!uploaded.error) return { ok: true, created: true, body }
  if (!storage.download) return { ok: false }
  try {
    const existing = await storage.download(path)
    if (existing.error || existing.data === undefined || existing.data === null) return { ok: false }
    const existingBytes = await storageValueToBytes(existing.data)
    if (existingBytes.byteLength > MAX_RESULT_BYTES) return { ok: false }
    const parsed = JSON.parse(new TextDecoder().decode(existingBytes)) as Record<string, unknown>
    const matchesIdentity = parsed.kind === identity.kind
      && parsed.materialId === identity.materialId
      && parsed.projectId === identity.projectId
      && parsed.runId === identity.runId
      && parsed.stepId === identity.stepId
    return matchesIdentity ? { ok: true, created: false, body: existingBytes } : { ok: false }
  } catch {
    return { ok: false }
  }
}

async function storageValueToBytes(value: unknown): Promise<Uint8Array> {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (typeof value === 'string') return new TextEncoder().encode(value)
  if (typeof Blob !== 'undefined' && value instanceof Blob) return new Uint8Array(await value.arrayBuffer())
  throw new Error('Nepoznat format privatnog objekta.')
}

function readExpiresAt(body: Uint8Array): string | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>
    return typeof parsed.expiresAt === 'string' && Number.isFinite(Date.parse(parsed.expiresAt)) ? parsed.expiresAt : null
  } catch {
    return null
  }
}

export async function loadAgentRunResults(
  manifests: RunPayloadManifestStore,
  storage: RunPayloadStorage,
  input: { runId: string; projectId: string; userId?: string; bucket?: string; now?: number },
): Promise<AgentStepResultPayloadV1[]> {
  if (!input.userId || !input.bucket) return []
  const entries = await manifests.list(input.runId, input.projectId)
  const resultEntries = entries.filter((entry) => entry.materialId.startsWith(RESULT_PREFIX)
    && isScopedAgentPayload(entry, { userId: input.userId, projectId: input.projectId, runId: input.runId, bucket: input.bucket }))
  if (resultEntries.length > MAX_RESULT_ENTRIES) throw new Error('Popis rezultata agenta je prevelik za sigurno učitavanje.')
  const budget = { totalBytes: 0 }
  const results = await mapWithConcurrency(resultEntries, 8, async (entry) => {
    try {
      const manifest = await parseJson(storage, entry.manifestPath, MAX_RESULT_MANIFEST_BYTES, budget)
      if (manifest.kind !== 'agent-step-result' || manifest.materialId !== entry.materialId || manifest.projectId !== input.projectId || manifest.runId !== input.runId) return null
      const payload = await parseJson(storage, entry.storagePath, MAX_RESULT_BYTES, budget)
      return validatePayload(payload, entry, input.now ?? Date.now())
    } catch {
      throw new Error('Rezultat agenta je prevelik ili nije valjan.')
    }
  })
  return results.filter((value): value is AgentStepResultPayloadV1 => Boolean(value)).sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

async function parseJson(storage: RunPayloadStorage, path: string, maxBytes: number, budget: { totalBytes: number }): Promise<Record<string, unknown>> {
  const raw = await storage.download(path)
  const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw) : raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw
  if (bytes.byteLength > maxBytes) throw new Error('Agent payload exceeds its size limit.')
  budget.totalBytes += bytes.byteLength
  if (budget.totalBytes > MAX_TOTAL_RESULT_BYTES) throw new Error('Agent result response exceeds its size limit.')
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid result payload.')
  return parsed as Record<string, unknown>
}

function validatePayload(value: Record<string, unknown>, entry: RunPayloadManifest, now: number): AgentStepResultPayloadV1 | null {
  if (value.schemaVersion !== 1 || value.kind !== 'agent-step-result') return null
  if (value.materialId !== entry.materialId || value.projectId !== entry.projectId || value.runId !== entry.runId) return null
  if (typeof value.stepId !== 'string' || !value.stepId.trim() || !isAgentId(value.agent) || value.verifier !== `${value.agent}_verifier` || typeof value.output !== 'string') return null
  if (value.stepOrder !== undefined && (!Number.isInteger(value.stepOrder) || Number(value.stepOrder) < 0)) return null
  const attempt = typeof value.attempt === 'number' ? value.attempt : NaN
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3) return null
  if (`${RESULT_PREFIX}${safeSegment(value.stepId)}:${attempt}` !== entry.materialId) return null
  if (!Array.isArray(value.citations) || !value.citations.every(isCitationEvidence) || !isVerificationResult(value.verification)) return null
  if (value.claims !== undefined && (!Array.isArray(value.claims) || !value.claims.every(isClaimEvidence))) return null
  if (value.inputArtifactIds !== undefined && (!Array.isArray(value.inputArtifactIds) || !value.inputArtifactIds.every((id) => typeof id === 'string' && id.trim().length > 0 && id.length <= 200))) return null
  if (typeof value.provider !== 'string' || !value.provider.trim() || !isUsageRecord(value.usage)) return null
  if (value.billingState !== undefined && !['settled', 'released', 'pending_reconciliation'].includes(String(value.billingState))) return null
  if (typeof value.createdAt !== 'string' || !isActiveTemporaryPayload(value.expiresAt, now)) return null
  return value as unknown as AgentStepResultPayloadV1
}

function isCitationEvidence(value: unknown): value is CitationEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const citation = value as Record<string, unknown>
  return typeof citation.id === 'string'
    && citation.id.trim().length > 0
    && typeof citation.verified === 'boolean'
    && (citation.title === undefined || typeof citation.title === 'string')
    && (citation.authors === undefined || typeof citation.authors === 'string')
    && (citation.year === undefined || (typeof citation.year === 'number' && Number.isInteger(citation.year)))
    && (citation.url === undefined || typeof citation.url === 'string')
    && (citation.doi === undefined || typeof citation.doi === 'string')
    && (citation.verification === undefined || isCitationVerification(citation.verification))
}

function isCitationVerification(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const verification = value as Record<string, unknown>
  return ['verified', 'needs_review', 'blocked'].includes(String(verification.status))
    && citationVerificationMethod(verification.method)
    && typeof verification.checkedAt === 'string'
    && (verification.titleMatch === undefined || typeof verification.titleMatch === 'boolean')
    && (verification.authorMatch === undefined || typeof verification.authorMatch === 'boolean')
    && (verification.yearMatch === undefined || typeof verification.yearMatch === 'boolean')
    && (verification.evidenceUrl === undefined || typeof verification.evidenceUrl === 'string')
    && (verification.retracted === undefined || typeof verification.retracted === 'boolean')
}

function isUsageRecord(value: unknown): value is UsageRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const usage = value as Record<string, unknown>
  return Number.isFinite(usage.inputTokens) && Number.isFinite(usage.outputTokens)
    && Number(usage.inputTokens) >= 0 && Number(usage.outputTokens) >= 0
}

function isVerificationResult(value: unknown): value is VerificationResultV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const verification = value as Record<string, unknown>
  return ['verified', 'needs_revision', 'blocked', 'failed'].includes(String(verification.status))
    && Array.isArray(verification.issues)
    && Array.isArray(verification.evidence)
    && verification.evidence.every(isCitationEvidence)
}

function isClaimEvidence(value: unknown): value is ClaimEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const claim = value as Record<string, unknown>
  return typeof claim.id === 'string'
    && claim.id.trim().length > 0
    && typeof claim.text === 'string'
    && claim.text.trim().length > 0
    && Array.isArray(claim.citationIds)
    && claim.citationIds.length <= 50
    && claim.citationIds.every((citationId) => typeof citationId === 'string' && citationId.trim().length > 0)
    && (claim.support === undefined || (Array.isArray(claim.support) && claim.support.length <= 20 && claim.support.every(isClaimSupport)))
}

function isClaimSupport(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const support = value as Record<string, unknown>
  return typeof support.citationId === 'string'
    && support.citationId.trim().length > 0
    && typeof support.quote === 'string'
    && support.quote.trim().length > 0
    && support.quote.length <= 2_000
    && (support.locator === undefined || (typeof support.locator === 'string' && support.locator.length <= 200))
    && (support.verification === undefined || isClaimSupportVerification(support.verification))
}

function isClaimSupportVerification(value: unknown): value is ClaimSupportVerification {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const verification = value as Record<string, unknown>
  return ['verified', 'needs_review', 'blocked'].includes(String(verification.status))
    && ['independent_gateway', 'deterministic_excerpt'].includes(String(verification.method))
    && typeof verification.checkedAt === 'string'
    && (verification.claimSupported === undefined || ['supported', 'unclear', 'contradicted'].includes(String(verification.claimSupported)))
    && (verification.confidence === undefined || (typeof verification.confidence === 'number' && Number.isFinite(verification.confidence) && verification.confidence >= 0 && verification.confidence <= 1))
    && (verification.evidenceUrl === undefined || isHttpUrl(verification.evidenceUrl))
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

function isActiveTemporaryPayload(value: unknown, now: number): boolean {
  if (typeof value !== 'string') return false
  const expiresAt = Date.parse(value)
  return Number.isFinite(expiresAt) && expiresAt > now
}

function safeSegment(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180)
  return cleaned || 'unknown'
}

function uniqueBoundedStrings(values: string[], max: number): string[] {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim().slice(0, 200)))].slice(0, max)
}
