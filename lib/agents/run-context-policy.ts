export type EditableAgentRunStatus = 'paused' | 'blocked'

export function canEditAgentRunContext(status: unknown): status is EditableAgentRunStatus {
  return status === 'paused' || status === 'blocked'
}
