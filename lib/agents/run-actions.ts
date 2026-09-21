import type { AgentRunStatus } from './run-state'

export function transitionRunStatus(status: AgentRunStatus, action: 'pause' | 'resume' | 'cancel'): AgentRunStatus {
  if (action === 'pause') {
    if (status !== 'running' && status !== 'pending') throw new Error(`Run u statusu ${status} nije moguće pauzirati.`)
    return 'paused'
  }
  if (action === 'resume') {
    if (status !== 'paused') throw new Error(`Run u statusu ${status} nije moguće nastaviti.`)
    return 'running'
  }
  if (status === 'completed') throw new Error('Završen run nije moguće otkazati.')
  return 'failed'
}
