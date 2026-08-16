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
  }
}

export function logAiEvent(event: AiEventMetadata, level: AiEventLevel = 'info'): void {
  const line = JSON.stringify(safeAiEvent(event))
  if (level === 'error') console.error(line)
  else console.info(line)
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
