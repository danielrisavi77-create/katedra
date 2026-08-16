import { safeErrorCode } from './ai-events'

export type OperationalEventLevel = 'info' | 'error'

export interface OperationalEvent {
  eventName: string
  requestId?: string
  userId?: string
  projectId?: string
  runId?: string
  sessionId?: string
  reservationRequestId?: string
  attempt?: number
  status?: number
  outcome?: string
  reason?: string
  error?: unknown
  errorCode?: string
  [key: string]: unknown
}

/**
 * Operational logs are deliberately separate from response payloads. Only
 * bounded identifiers and allowlisted state are emitted; errors become codes
 * so SQL/provider messages and user content never reach server logs.
 */
export function safeOperationalEvent(event: OperationalEvent): Record<string, unknown> {
  return {
    eventName: boundedString(event.eventName, 100),
    ...optionalString(event.requestId, 'requestId', 120),
    ...optionalString(event.userId, 'userId', 120),
    ...optionalString(event.projectId, 'projectId', 120),
    ...optionalString(event.runId, 'runId', 120),
    ...optionalString(event.sessionId, 'sessionId', 160),
    ...optionalString(event.reservationRequestId, 'reservationRequestId', 160),
    ...optionalInteger(event.attempt, 'attempt'),
    ...optionalInteger(event.status, 'status'),
    ...optionalString(event.outcome, 'outcome', 80),
    ...optionalString(event.reason, 'reason', 120),
    ...optionalString(event.errorCode || (event.error !== undefined ? safeErrorCode(event.error) : undefined), 'errorCode', 120),
  }
}

export function logOperationalEvent(event: OperationalEvent, level: OperationalEventLevel = 'info'): void {
  const line = JSON.stringify(safeOperationalEvent(event))
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
