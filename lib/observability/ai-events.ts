export type AiEventLevel = 'info' | 'error'

export interface AiEventMetadata {
  eventName: string
  requestId: string
  userId: string
  projectId: string
  billingRequestId?: string
  runId?: string
  agent?: string
  provider?: string
  model?: string
  attempt?: number
  retryCount?: number
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  estimatedCharge?: number
  charged?: number
  citationCount?: number
  inputArtifactCount?: number
  billingState?: string
  outcome?: string
  reason?: string
  errorCode?: string
  status?: number
  [key: string]: unknown
}

/**
 * The only fields allowed into an AI operational log. Prompt, manuscript,
 * provider response and arbitrary error objects are intentionally ignored.
 */
export function safeAiEvent(event: AiEventMetadata): Record<string, unknown> {
  return {
    eventName: boundedString(event.eventName, 100),
    requestId: boundedString(event.requestId, 120),
    userId: boundedString(event.userId, 120),
    projectId: boundedString(event.projectId, 120),
    ...optionalString(event.billingRequestId, 'billingRequestId', 120),
    ...optionalString(event.runId, 'runId', 120),
    ...optionalString(event.agent, 'agent', 80),
    ...optionalString(event.provider, 'provider', 120),
    ...optionalString(event.model, 'model', 120),
    ...optionalInteger(event.attempt, 'attempt'),
    ...optionalInteger(event.retryCount, 'retryCount'),
    ...optionalInteger(event.latencyMs, 'latencyMs'),
    ...optionalInteger(event.inputTokens, 'inputTokens'),
    ...optionalInteger(event.outputTokens, 'outputTokens'),
    ...optionalInteger(event.estimatedCharge, 'estimatedCharge'),
    ...optionalInteger(event.charged, 'charged'),
    ...optionalInteger(event.citationCount, 'citationCount'),
    ...optionalInteger(event.inputArtifactCount, 'inputArtifactCount'),
    ...optionalString(event.billingState, 'billingState', 80),
    ...optionalString(event.outcome, 'outcome', 80),
    ...optionalString(event.reason, 'reason', 120),
    ...optionalString(event.errorCode, 'errorCode', 120),
    ...optionalInteger(event.status, 'status'),
    ...optionalGateSummary(event.gate),
  }
}

export function logAiEvent(event: AiEventMetadata, level: AiEventLevel = 'info'): void {
  const line = JSON.stringify(safeAiEvent(event))
  if (level === 'error') console.error(line)
  else console.info(line)
}

/**
 * Converts an unknown infrastructure/provider error into a bounded code.
 * Error messages are intentionally never returned because they may contain
 * SQL, upstream response text or user-supplied content.
 */
export function safeErrorCode(value: unknown): string {
  const candidate = value instanceof Error
    ? value.name
    : value && typeof value === 'object' && !Array.isArray(value) && typeof (value as Record<string, unknown>).code === 'string'
      ? String((value as Record<string, unknown>).code)
      : ''
  const normalized = candidate.trim().replace(/[^A-Za-z0-9_.-]+/gu, '_').slice(0, 80)
  return normalized || 'unknown_error'
}

function optionalString(value: unknown, key: string, max: number): Record<string, string> {
  if (typeof value !== 'string' || !value.trim()) return {}
  return { [key]: value.trim().slice(0, max) }
}

function optionalInteger(value: unknown, key: string): Record<string, number> {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) return {}
  return { [key]: value }
}

function boundedString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}


function optionalGateSummary(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const gate = value as Record<string, unknown>
  return { gate: {
    ...(['plan', 'pisanje', 'audit', 'predaja'].includes(String(gate.faza)) ? { faza: gate.faza } : {}),
    ...(typeof gate.prolaz === 'boolean' ? { prolaz: gate.prolaz } : {}),
    ...optionalInteger(gate.exitCode, 'exitCode'),
    koraci: (Array.isArray(gate.koraci) ? gate.koraci : []).slice(0, 100).flatMap((step) => {
      if (!step || typeof step !== 'object') return []
      return [{
        ...optionalString(step.korak, 'korak', 80),
        ...optionalString(step.stanje, 'stanje', 40),
        ...(typeof step.blokira === 'boolean' ? { blokira: step.blokira } : {}),
      }]
    }),
  } }
}
