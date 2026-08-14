import { registerAgentPayload } from './backend-contract'
import type { AgentResultV1, CitationEvidence, UsageRecord, VerificationResultV1 } from './contracts'
import type { AgentStepRecord } from './run-state'
import type { RunPayloadManifest, RunPayloadManifestStore, RunPayloadStorage } from './run-context-loader'

const DEFAULT_BUCKET = 'katedra-temporary-materials'
const RESULT_TTL_MS = 72 * 60 * 60 * 1000
const MAX_RESULT_BYTES = 1_500_000
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
  sectionId?: string
  baseRevision?: string
  attempt: 1 | 2 | 3
  output: string
  citations: CitationEvidence[]
  verification: VerificationResultV1
  provider: string
  usage: UsageRecord
  createdAt: string
  expiresAt: string
}

interface ResultStorageObjectClient {
  upload: (path: string, body: Uint8Array, options: { contentType: string; cacheControl: string; upsert: boolean }) => Promise<{ error?: { message?: string } | null }>
  remove: (paths: string[]) => Promise<{ error?: { message?: string } | null }>
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
    ...(input.step.sectionId ? { sectionId: input.step.sectionId } : {}),
    ...(input.result.baseRevision ? { baseRevision: input.result.baseRevision } : {}),
    attempt: input.step.attempt,
    output,
    citations: Array.isArray(input.result.citations) ? input.result.citations.slice(0, 100) : [],
    verification: input.verification,
    provider: input.result.provider,
    usage: input.result.usage || { inputTokens: 0, outputTokens: 0 },
    createdAt,
    expiresAt,
  }
  const body = new TextEncoder().encode(JSON.stringify(payload))
  if (body.byteLength > MAX_RESULT_BYTES) return { ok: false, error: 'Rezultat agenta je prevelik za privremenu pohranu.' }
  const bucket = input.bucket || DEFAULT_BUCKET
  const manifest = { ...payload, storageBucket: bucket, storagePath, manifestPath }
  const storage = db.storage.from(bucket)
  const upload = await storage.upload(storagePath, body, { contentType: 'application/json', cacheControl: '3600', upsert: true })
  if (upload.error) return { ok: false, error: 'Spremanje rezultata agenta nije uspjelo.' }
  const manifestUpload = await storage.upload(manifestPath, new TextEncoder().encode(JSON.stringify(manifest)), { contentType: 'application/json', cacheControl: '3600', upsert: true })
  if (manifestUpload.error) {
    await storage.remove([storagePath])
    return { ok: false, error: 'Spremanje manifesta rezultata nije uspjelo.' }
  }
  const registered = await registerAgentPayload(db, {
    userId: input.userId,
    projectId: input.projectId,
    runId: input.runId,
    materialId,
    storageBucket: bucket,
    storagePath,
    manifestPath,
    expiresAt,
  })
  if (!registered.ok) {
    await storage.remove([storagePath, manifestPath])
    return { ok: false, error: 'Registracija rezultata agenta nije uspjela.' }
  }
  return { ok: true, value: { manifestId: registered.value.manifestId, materialId, expiresAt } }
}

export async function loadAgentRunResults(
  manifests: RunPayloadManifestStore,
  storage: RunPayloadStorage,
  input: { runId: string; projectId: string },
): Promise<AgentStepResultPayloadV1[]> {
  const entries = await manifests.list(input.runId, input.projectId)
  const results = await Promise.all(entries.filter((entry) => entry.materialId.startsWith(RESULT_PREFIX)).map(async (entry) => {
    try {
      const manifest = await parseJson(storage, entry.manifestPath)
      if (manifest.kind !== 'agent-step-result' || manifest.materialId !== entry.materialId || manifest.projectId !== input.projectId || manifest.runId !== input.runId) return null
      const payload = await parseJson(storage, entry.storagePath)
      return validatePayload(payload, entry)
    } catch {
      return null
    }
  }))
  return results.filter((value): value is AgentStepResultPayloadV1 => Boolean(value)).sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

async function parseJson(storage: RunPayloadStorage, path: string): Promise<Record<string, unknown>> {
  const raw = await storage.download(path)
  const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw) : raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid result payload.')
  return parsed as Record<string, unknown>
}

function validatePayload(value: Record<string, unknown>, entry: RunPayloadManifest): AgentStepResultPayloadV1 | null {
  if (value.schemaVersion !== 1 || value.kind !== 'agent-step-result') return null
  if (value.materialId !== entry.materialId || value.projectId !== entry.projectId || value.runId !== entry.runId) return null
  if (typeof value.stepId !== 'string' || typeof value.agent !== 'string' || typeof value.verifier !== 'string' || typeof value.output !== 'string') return null
  if (!Array.isArray(value.citations) || !value.verification || typeof value.verification !== 'object') return null
  if (typeof value.provider !== 'string' || !value.usage || typeof value.usage !== 'object') return null
  if (typeof value.createdAt !== 'string' || typeof value.expiresAt !== 'string') return null
  return value as unknown as AgentStepResultPayloadV1
}

function safeSegment(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180)
  return cleaned || 'unknown'
}
