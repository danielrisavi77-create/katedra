import { describe, expect, it, vi } from 'vitest'

import { logAgentEvent } from './agent-events'

describe('agent telemetry', () => {
  it('logs bounded metadata without accepting manuscript content', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      logAgentEvent({
        eventName: 'agent_provider_completed',
        requestId: 'run-1:step-1:1',
        userId: 'user-1',
        projectId: 'project-1',
        runId: 'run-1',
        agent: 'writing',
        provider: 'anthropic',
        attempt: 1,
        latencyMs: 412,
        inputTokens: 12,
        outputTokens: 8,
        outcome: 'settled',
        manuscriptText: 'ovo se ne smije logirati',
      })

      expect(info).toHaveBeenCalledWith(expect.stringContaining('agent_provider_completed'))
      const serialized = String(info.mock.calls[0][0])
      expect(serialized).toContain('project-1')
      expect(serialized).not.toContain('ovo se ne smije logirati')
    } finally {
      info.mockRestore()
    }
  })
})
