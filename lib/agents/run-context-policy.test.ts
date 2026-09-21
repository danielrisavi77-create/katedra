import { describe, expect, it } from 'vitest'

import { canEditAgentRunContext } from './run-context-policy'

describe('agent run context edit policy', () => {
  it('allows only paused or blocked intervention runs', () => {
    expect(canEditAgentRunContext('paused')).toBe(true)
    expect(canEditAgentRunContext('blocked')).toBe(true)
    expect(canEditAgentRunContext('initializing')).toBe(false)
    expect(canEditAgentRunContext('pending')).toBe(false)
    expect(canEditAgentRunContext('running')).toBe(false)
    expect(canEditAgentRunContext('completed')).toBe(false)
  })
})
