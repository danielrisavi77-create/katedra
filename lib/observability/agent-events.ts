import { logAiEvent } from './ai-events'

export interface AgentEventMetadata {
  eventName: string
  requestId: string
  userId: string
  projectId: string
  runId: string
  agent: string
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
  reason?: string
  errorCode?: string
  status?: number
  outcome?: string
  [key: string]: unknown
}

/**
 * Keep agent logs useful for operations while making it impossible for a
 * caller to accidentally add manuscript/output text to the event.
 */
export function logAgentEvent(event: AgentEventMetadata): void {
  logAiEvent(event)
}
