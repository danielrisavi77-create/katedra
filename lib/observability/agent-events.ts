export interface AgentEventMetadata {
  eventName: string
  requestId: string
  userId: string
  projectId: string
  runId: string
  agent: string
  provider?: string
  attempt?: number
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  citationCount?: number
  inputArtifactCount?: number
  outcome?: string
  [key: string]: unknown
}

/**
 * Keep agent logs useful for operations while making it impossible for a
 * caller to accidentally add manuscript/output text to the event.
 */
export function logAgentEvent(event: AgentEventMetadata): void {
  const allowed = {
    eventName: boundedString(event.eventName, 100),
    requestId: boundedString(event.requestId, 120),
    userId: boundedString(event.userId, 120),
    projectId: boundedString(event.projectId, 120),
    runId: boundedString(event.runId, 120),
    agent: boundedString(event.agent, 80),
    ...(event.provider !== undefined ? { provider: boundedString(event.provider, 120) } : {}),
    ...(finiteInteger(event.attempt) ? { attempt: event.attempt } : {}),
    ...(finiteInteger(event.latencyMs) ? { latencyMs: event.latencyMs } : {}),
    ...(finiteInteger(event.inputTokens) ? { inputTokens: event.inputTokens } : {}),
    ...(finiteInteger(event.outputTokens) ? { outputTokens: event.outputTokens } : {}),
    ...(finiteInteger(event.citationCount) ? { citationCount: event.citationCount } : {}),
    ...(finiteInteger(event.inputArtifactCount) ? { inputArtifactCount: event.inputArtifactCount } : {}),
    ...(event.outcome !== undefined ? { outcome: boundedString(event.outcome, 80) } : {}),
  }
  console.info(JSON.stringify(allowed))
}

function boundedString(value: string, max: number): string {
  return String(value || '').slice(0, max)
}

function finiteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
}
